import React, { useState, useEffect } from "react";
import { Project, UnitItem, Transaction } from "../types";
import { getTodayShamsiString } from "../utils/shamsi";
import { 
  Plus, Calculator, Percent, ShieldCheck, ChevronLeft, Building, 
  MapPin, Users, Coins, CheckCircle, RefreshCw, Trash2, Edit3, Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CONSTRUCTION_STAGES_NAMES } from "../data/constructionStages";
import { FormattedAmountInput } from "./FormattedAmountInput";

interface ProjectsManagerProps {
  projects: Project[];
  units: UnitItem[];
  transactions: Transaction[];
  onAddProject: (project: Partial<Project>) => void;
  onUpdateUnit: (unitId: string, updatedData: Partial<UnitItem>) => void;
  onAddUnitExpense: (unitId: string, expense: { title: string; amount: number; date: string }) => void;
  onDeleteUnit?: (unitId: string) => void;
  onRestoreUnit?: (unitId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onRestoreProject?: (projectId: string) => void;
  onBatchGenerateUnits?: (projectId: string, unitsList: any[]) => void;
}

interface FloorSetting {
  floorNum: number;
  unitCount: number;
  roughArea: number;
  pricePerMeter: number;
}

export default function ProjectsManager({ 
  projects, 
  units, 
  transactions, 
  onAddProject, 
  onUpdateUnit, 
  onAddUnitExpense,
  onDeleteUnit,
  onRestoreUnit,
  onDeleteProject,
  onRestoreProject,
  onBatchGenerateUnits
}: ProjectsManagerProps) {
  const activeProjects = projects.filter(p => !p.isDeleted);
  const deletedProjects = projects.filter(p => p.isDeleted);

  const [activeProjId, setActiveProjId] = useState<string>("");

  useEffect(() => {
    if (activeProjects.length > 0 && (!activeProjId || !activeProjects.some(p => p.id === activeProjId))) {
      setActiveProjId(activeProjects[0].id);
    }
  }, [projects, activeProjId]);

  const [isAddingProj, setIsAddingProj] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [unitDeleteConfirm, setUnitDeleteConfirm] = useState<number>(0);
  const [projDeleteConfirm, setProjDeleteConfirm] = useState<number>(0);

  // Form states for new project
  const [projName, setProjName] = useState("");
  const [projAddress, setProjAddress] = useState("");
  const [projArea, setProjArea] = useState("");
  const [projBudget, setProjBudget] = useState("");
  const [projStage, setProjStage] = useState(CONSTRUCTION_STAGES_NAMES[0] || "۱. هزینه‌های زمین و مالکیت");
  const [projSupervisor, setProjSupervisor] = useState("مهندس میلاد فرخی");
  const [projNumUnits, setProjNumUnits] = useState("");
  const [projDefaultUnitArea, setProjDefaultUnitArea] = useState("");
  const [projDefaultUnitPrice, setProjDefaultUnitPrice] = useState("");

  // Edit Project States
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editStage, setEditStage] = useState("");
  const [editSupervisor, setEditSupervisor] = useState("");
  const [editNumUnits, setEditNumUnits] = useState("");

  // Add Single Unit States
  const [isAddingSingleUnit, setIsAddingSingleUnit] = useState(false);
  const [singleUnitNumber, setSingleUnitNumber] = useState("");
  const [singleFloor, setSingleFloor] = useState("0");
  const [singleArea, setSingleArea] = useState("");
  const [singlePricePerMeter, setSinglePricePerMeter] = useState("");

  // Block Partitioning / Batch Units States
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchBlockName, setBatchBlockName] = useState("A");
  const [batchNumFloors, setBatchNumFloors] = useState("4");
  const [floorSettings, setFloorSettings] = useState<FloorSetting[]>([]);

  // Pre-sale form states
  const [saleStatus, setSaleStatus] = useState<"available" | "pre_sold" | "sold" | "bartered" | "any">("available");
  const [buyerName, setBuyerName] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [barterProperty, setBarterProperty] = useState("");

  // Physical unit edit states
  const [isEditingPhysicalProps, setIsEditingPhysicalProps] = useState(false);
  const [editUnitNumber, setEditUnitNumber] = useState("");
  const [editUnitFloor, setEditUnitFloor] = useState("");
  const [editUnitArea, setEditUnitArea] = useState("");
  const [editUnitPricePerMeter, setEditUnitPricePerMeter] = useState("");

  // Custom unit expense states
  const [unitExpTitle, setUnitExpTitle] = useState("");
  const [unitExpAmount, setUnitExpAmount] = useState("");

  const selectedProj = activeProjects.find(p => p.id === activeProjId);
  const projUnits = units.filter(u => u.projectId === activeProjId && !u.isDeleted);
  const deletedProjUnits = units.filter(u => u.projectId === activeProjId && u.isDeleted);

  // Reset confirmation states on selection change
  useEffect(() => {
    setProjDeleteConfirm(0);
  }, [activeProjId]);

  useEffect(() => {
    setUnitDeleteConfirm(0);
  }, [selectedUnit]);

  // Update edit form states when selected project changes
  useEffect(() => {
    if (selectedProj) {
      setEditName(selectedProj.name);
      setEditAddress(selectedProj.address);
      setEditArea(String(selectedProj.totalArea || ""));
      setEditBudget(String(selectedProj.budget || ""));
      setEditStage(selectedProj.currentStage || CONSTRUCTION_STAGES_NAMES[0]);
      setEditSupervisor((selectedProj as any).supervisorName || "مهندس میلاد فرخی");
      setEditNumUnits(String(selectedProj.numberOfUnits || ""));
    }
  }, [selectedProj, isEditingProj]);

  // Set up floor settings dynamically when batch generate floor count changes
  useEffect(() => {
    const num = Number(batchNumFloors) || 0;
    if (num <= 0) {
      setFloorSettings([]);
      return;
    }
    setFloorSettings(prev => {
      const result: FloorSetting[] = [];
      for (let i = 0; i < num; i++) {
        const existing = prev.find(p => p.floorNum === i);
        result.push(existing || {
          floorNum: i,
          unitCount: 2, // default 2 units per floor
          roughArea: selectedProj?.defaultUnitArea || 100, // default rough area
          pricePerMeter: selectedProj?.defaultUnitPrice || 35000000 // default price per sqm (Rial)
        });
      }
      return result;
    });
  }, [batchNumFloors, selectedProj, isBatchGenerating]);

  // Reset active selected unit details when selecting a unit
  useEffect(() => {
    if (selectedUnit) {
      setSaleStatus(selectedUnit.status || "available");
      setBuyerName(selectedUnit.buyerName || "");
      setDownPayment(String(selectedUnit.downPayment || ""));
      setBarterProperty(selectedUnit.barterProperty || "");
      
      setEditUnitNumber(selectedUnit.unitNumber);
      setEditUnitFloor(selectedUnit.floor);
      setEditUnitArea(String(selectedUnit.area || ""));
      setEditUnitPricePerMeter(String(selectedUnit.pricePerMeter || ""));
      setIsEditingPhysicalProps(false);
    }
  }, [selectedUnit]);

  const formatRials = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  // Calculate project expenses
  const projExpenses = transactions
    .filter(t => t.projectId === activeProjId && t.type === "expense")
    .reduce((sum, curr) => sum + curr.amount, 0);

  // Calculate cost per square meter
  const totalArea = selectedProj?.totalArea || 1;
  const costPerSqm = Math.round(projExpenses / totalArea);

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName) return;
    onAddProject({
      name: projName,
      address: projAddress,
      totalArea: Number(projArea),
      budget: Number(projBudget),
      stages: CONSTRUCTION_STAGES_NAMES,
      currentStage: projStage,
      status: "active",
      supervisorName: projSupervisor,
      numberOfUnits: projNumUnits ? Number(projNumUnits) : undefined,
      defaultUnitArea: projDefaultUnitArea ? Number(projDefaultUnitArea) : undefined,
      defaultUnitPrice: projDefaultUnitPrice ? Number(projDefaultUnitPrice) : undefined
    });
    setProjName("");
    setProjAddress("");
    setProjArea("");
    setProjBudget("");
    setProjSupervisor("مهندس میلاد فرخی");
    setProjNumUnits("");
    setProjDefaultUnitArea("");
    setProjDefaultUnitPrice("");
    setIsAddingProj(false);
  };

  const handleSaveProjectEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !editName) return;
    onAddProject({
      ...selectedProj,
      name: editName,
      address: editAddress,
      totalArea: Number(editArea),
      budget: Number(editBudget),
      currentStage: editStage,
      supervisorName: editSupervisor,
      numberOfUnits: editNumUnits ? Number(editNumUnits) : undefined
    });
    setIsEditingProj(false);
  };

  const handleAddSingleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !singleUnitNumber || !singleFloor) return;
    if (onBatchGenerateUnits) {
      onBatchGenerateUnits(selectedProj.id, [{
        unitNumber: singleUnitNumber,
        floor: singleFloor,
        area: Number(singleArea || 0),
        pricePerMeter: Number(singlePricePerMeter || 0),
        status: "available",
        specificExpenses: []
      }]);
    }
    setSingleUnitNumber("");
    setSingleFloor("0");
    setSingleArea("");
    setSinglePricePerMeter("");
    setIsAddingSingleUnit(false);
  };

  const handleBatchGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !batchBlockName || floorSettings.length === 0) return;

    const generatedUnitsList: any[] = [];
    floorSettings.forEach(fs => {
      for (let uIdx = 1; uIdx <= fs.unitCount; uIdx++) {
        // Dynamic unit numbering based on block, floor, and unit index
        // Floor 0 (همکف) Unit 3 -> A03
        // Floor 1 (اول) Unit 3 -> A13
        const unitNumStr = `${batchBlockName}${fs.floorNum}${uIdx}`;
        
        generatedUnitsList.push({
          unitNumber: unitNumStr,
          floor: String(fs.floorNum),
          area: fs.roughArea,
          pricePerMeter: fs.pricePerMeter,
          status: "available",
          specificExpenses: []
        });
      }
    });

    if (onBatchGenerateUnits) {
      onBatchGenerateUnits(selectedProj.id, generatedUnitsList);
    }
    setIsBatchGenerating(false);
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    onUpdateUnit(selectedUnit.id, {
      status: saleStatus === "any" ? "available" : saleStatus,
      buyerName: saleStatus !== "available" && saleStatus !== "any" ? buyerName : undefined,
      downPayment: saleStatus === "pre_sold" || saleStatus === "sold" ? Number(downPayment) : undefined,
      barterProperty: saleStatus === "bartered" ? barterProperty : undefined
    });
    setSelectedUnit(null);
    setBuyerName("");
    setDownPayment("");
    setBarterProperty("");
  };

  const handleSavePhysicalProps = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    onUpdateUnit(selectedUnit.id, {
      unitNumber: editUnitNumber,
      floor: editUnitFloor,
      area: Number(editUnitArea || 0),
      pricePerMeter: Number(editUnitPricePerMeter || 0),
      totalPrice: Number(editUnitArea || 0) * Number(editUnitPricePerMeter || 0)
    });
    setIsEditingPhysicalProps(false);
    setSelectedUnit(null); // Deselect to force refresh state in parent
    alert("مشخصات فیزیکی واحد با موفقیت بروزرسانی شد.");
  };

  const handleSaveUnitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !unitExpTitle || !unitExpAmount) return;
    onAddUnitExpense(selectedUnit.id, {
      title: unitExpTitle,
      amount: Number(unitExpAmount),
      date: getTodayShamsiString()
    });
    setUnitExpTitle("");
    setUnitExpAmount("");
    // Close & Refresh state
    const updated = units.find(u => u.id === selectedUnit.id);
    if (updated) setSelectedUnit(updated);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Project Selector Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-150 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 leading-none">مدیریت پروژه‌ها و واحدهای مسکونی</h2>
            <p className="text-slate-400 text-[10px] font-light mt-1.5">بلوک‌بندی، تقسیم واحدهای مسکونی بر اساس متراژ تقریبی، پیش‌فروش، تهاتر و هزینه‌یابی تفکیکی</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              setIsAddingProj(!isAddingProj);
              setIsEditingProj(false);
              setIsAddingSingleUnit(false);
              setIsBatchGenerating(false);
            }}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            تعریف پروژه جدید
          </button>

          <select 
            value={activeProjId}
            onChange={(e) => {
              setActiveProjId(e.target.value);
              setSelectedUnit(null);
              setIsEditingProj(false);
              setIsAddingSingleUnit(false);
              setIsBatchGenerating(false);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold outline-none focus:border-teal-500 shadow-sm cursor-pointer"
          >
            {activeProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Add Project Form Card */}
      {isAddingProj && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-150 shadow-md space-y-4"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">🏗️ ثبت پروژه عمرانی و ساختمانی جدید</h3>
            <button onClick={() => setIsAddingProj(false)} className="text-slate-400 hover:text-slate-600 text-xs">بستن ×</button>
          </div>
          <form onSubmit={handleSubmitProject} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold">نام پروژه ساختمانی <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                placeholder="مثال: مجتمع مسکونی مهرتاش"
                value={projName}
                onChange={e => setProjName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold">کل زیربنای ناخالص (مترمربع)</label>
              <input 
                type="number" 
                placeholder="مثال: ۲۴۰۰"
                value={projArea}
                onChange={e => setProjArea(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold">بودجه ساخت برآوردی (ریال)</label>
              <FormattedAmountInput 
                placeholder="مثال: ۴۸,۰۰۰,۰۰۰,۰۰۰"
                value={projBudget}
                onChange={setProjBudget}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 font-mono text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold">مرحله فعلی ساخت</label>
              <select 
                value={projStage}
                onChange={e => setProjStage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
              >
                {CONSTRUCTION_STAGES_NAMES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-500 font-semibold">آدرس دقیق پروژه</label>
              <input 
                type="text" 
                placeholder="تهران، بزرگراه..."
                value={projAddress}
                onChange={e => setProjAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold">مهندس ارشد و ناظر پروژه</label>
              <input 
                type="text" 
                placeholder="مثال: مهندس میلاد فرخی"
                value={projSupervisor}
                onChange={e => setProjSupervisor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
              />
            </div>

            <div className="md:col-span-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-full font-bold text-slate-700 text-[11px] mb-1">🏗️ تعریف و تولید خودکار واحدهای هم‌اندازه (اختیاری)</div>
              <div className="space-y-1.5">
                <label className="text-slate-500">تعداد کل واحدهای پروژه</label>
                <input 
                  type="number" 
                  placeholder="مثال: ۸"
                  value={projNumUnits}
                  onChange={e => setProjNumUnits(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-500 text-center font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-500">متراژ هر واحد (مترمربع پیش‌فرض)</label>
                <input 
                  type="number" 
                  placeholder="مثال: ۱۲۰"
                  value={projDefaultUnitArea}
                  onChange={e => setProjDefaultUnitArea(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-500 text-center font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-500">قیمت فروش پایه هر متر (ریال)</label>
                <FormattedAmountInput 
                  value={projDefaultUnitPrice}
                  onChange={setProjDefaultUnitPrice}
                  placeholder="مثال: ۳۵,۰۰۰,۰۰۰"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-teal-500 text-center font-mono"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-end gap-2 pt-2">
              <button 
                type="submit" 
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
              >
                ثبت پروژه جدید
              </button>
              <button 
                type="button" 
                onClick={() => setIsAddingProj(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Edit Project Form Card */}
      {isEditingProj && selectedProj && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/20 border border-amber-200 p-6 rounded-2xl shadow-md space-y-4"
        >
          <div className="flex justify-between items-center border-b border-amber-100 pb-2">
            <h3 className="font-extrabold text-amber-900 text-xs flex items-center gap-1">✏️ ویرایش شناسنامه پروژه «{selectedProj.name}»</h3>
            <button onClick={() => setIsEditingProj(false)} className="text-amber-800 hover:text-amber-950 text-xs">بستن ×</button>
          </div>
          <form onSubmit={handleSaveProjectEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">نام پروژه ساختمانی <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold text-slate-900"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">کل زیربنای ناخالص (مترمربع)</label>
              <input 
                type="number" 
                value={editArea}
                onChange={e => setEditArea(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">بودجه ساخت برآوردی (ریال)</label>
              <FormattedAmountInput 
                placeholder="مثال: ۴۸,۰۰۰,۰۰۰,۰۰۰"
                value={editBudget}
                onChange={setEditBudget}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900 font-mono text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">مرحله فعلی ساخت</label>
              <select 
                value={editStage}
                onChange={e => setEditStage(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900"
              >
                {CONSTRUCTION_STAGES_NAMES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-600 font-semibold">آدرس دقیق پروژه</label>
              <input 
                type="text" 
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">مهندس ارشد و ناظر پروژه</label>
              <input 
                type="text" 
                value={editSupervisor}
                onChange={e => setEditSupervisor(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-600 font-semibold">تعداد کل واحدها</label>
              <input 
                type="number" 
                value={editNumUnits}
                onChange={e => setEditNumUnits(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-slate-900 font-mono text-center font-bold"
                placeholder="تعداد واحدها"
              />
            </div>

            <div className="md:col-span-2 flex items-end gap-2 pt-2">
              <button 
                type="submit" 
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
              >
                ذخیره تغییرات پروژه
              </button>
              <button 
                type="button" 
                onClick={() => setIsEditingProj(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Add Single Unit Form Card */}
      {isAddingSingleUnit && selectedProj && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-150 shadow-md space-y-4"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">➕ افزودن تک واحد جدید به پروژه عمرانی</h3>
            <button onClick={() => setIsAddingSingleUnit(false)} className="text-slate-400 hover:text-slate-600 text-xs">بستن ×</button>
          </div>
          <form onSubmit={handleAddSingleUnitSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-500">شماره / نام واحد <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                placeholder="مثل: 101 یا A03"
                value={singleUnitNumber}
                onChange={e => setSingleUnitNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center font-mono focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">شماره طبقه <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                placeholder="مثل: 0 برای همکف، 1، 2"
                value={singleFloor}
                onChange={e => setSingleFloor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center font-mono focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">متراژ تقریبی واحد (مترمربع)</label>
              <input 
                type="number" 
                placeholder="مثال: ۱۲۰"
                value={singleArea}
                onChange={e => setSingleArea(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center font-mono focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">قیمت پایه هر متر (ریال)</label>
              <FormattedAmountInput 
                value={singlePricePerMeter}
                onChange={setSinglePricePerMeter}
                placeholder="مثال: ۳۵,۰۰۰,۰۰۰"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center font-mono focus:border-teal-500"
              />
            </div>

            <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button 
                type="submit" 
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                ثبت و ایجاد واحد
              </button>
              <button 
                type="button" 
                onClick={() => setIsAddingSingleUnit(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Dynamic Floor Partitioning & Batch Units Generator Assistant Card */}
      {isBatchGenerating && selectedProj && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50/30 border border-indigo-200 p-6 rounded-2xl shadow-md space-y-5"
        >
          <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-indigo-600 animate-spin" />
              <h3 className="font-extrabold text-indigo-950 text-xs">دستیار بلوک‌بندی و تولید دسته‌جمعی واحدها</h3>
            </div>
            <button onClick={() => setIsBatchGenerating(false)} className="text-indigo-800 hover:text-indigo-950 text-xs font-bold">بستن ×</button>
          </div>

          <form onSubmit={handleBatchGenerateSubmit} className="space-y-4 text-xs">
            {/* Top Config */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-semibold text-slate-700">
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-500">کد/نام بلوک (مثلاً A یا B)</label>
                <input 
                  type="text"
                  maxLength={5}
                  value={batchBlockName}
                  onChange={e => setBatchBlockName(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-900 font-mono outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-500">تعداد طبقات این بلوک</label>
                <input 
                  type="number"
                  min="1"
                  max="20"
                  value={batchNumFloors}
                  onChange={e => setBatchNumFloors(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-bold text-indigo-900 font-mono outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col justify-center">
                <span className="text-[10px] text-indigo-800 block leading-relaxed font-normal">
                  💡 <strong>قاعده شماره‌گذاری خودکار واحدها:</strong> شماره واحد بر اساس نام بلوک، شماره طبقه و شماره واحد روی طبقه خواهد بود.
                </span>
                <span className="text-[10px] text-indigo-900 font-bold block mt-1">
                  مثلاً: بلوک {batchBlockName}، طبقه همکف (۰)، واحد ۳ 👈 {batchBlockName}03
                </span>
              </div>
            </div>

            {/* Dynamic Floor list */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              <span className="block font-bold text-slate-800 text-[11px] mb-1">📋 تنظیمات مجزا برای هر طبقه بلوک {batchBlockName}:</span>
              
              {floorSettings.map((fs, idx) => (
                <div key={fs.floorNum} className="p-3 bg-white border border-slate-150 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>طبقه {fs.floorNum === 0 ? "همکف (۰)" : toFarsiDigits(fs.floorNum)}</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block">تعداد واحد متفاوت این طبقه</label>
                    <input 
                      type="number"
                      min="1"
                      value={fs.unitCount}
                      onChange={e => {
                        const updated = [...floorSettings];
                        updated[idx].unitCount = Number(e.target.value) || 1;
                        setFloorSettings(updated);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-center font-bold font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block">متراژ تقریبی واحدها (مترمربع)</label>
                    <input 
                      type="number"
                      min="1"
                      value={fs.roughArea}
                      onChange={e => {
                        const updated = [...floorSettings];
                        updated[idx].roughArea = Number(e.target.value) || 1;
                        setFloorSettings(updated);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-center font-bold font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block">قیمت فروش پایه هر متر (ریال)</label>
                    <FormattedAmountInput 
                      value={fs.pricePerMeter}
                      onChange={val => {
                        const updated = [...floorSettings];
                        updated[idx].pricePerMeter = Number(val) || 0;
                        setFloorSettings(updated);
                      }}
                      placeholder="مثال: ۳۵,۰۰۰,۰۰۰"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-center font-bold font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-indigo-100 flex justify-end gap-2">
              <button 
                type="submit" 
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-sm"
              >
                تولید و ثبت خودکار تمام واحدهای بلوک {batchBlockName}
              </button>
              <button 
                type="button" 
                onClick={() => setIsBatchGenerating(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
              >
                انصراف
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
                    setIsBatchGenerating(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl border border-slate-100 transition-colors cursor-pointer"
                  title="ویرایش اطلاعات کلی پروژه"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* Delete Project Button with 3-step confirmation */}
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
                        <span className={`w-2 h-2 rounded-full ${
                          isActive ? "bg-amber-500 animate-pulse" : isPassed ? "bg-teal-500" : "bg-slate-200"
                        }`} />
                        <span className={`${
                          isActive ? "text-amber-600 font-bold" : isPassed ? "text-teal-600" : "text-slate-400 font-light"
                        }`}>
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
                    {/* Deleted Projects list */}
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

                    {/* Deleted Units list */}
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

          {/* Bento Box 2 & 3: Units Grid & Action Drawer */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Sales Grid */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">🏢 وضعیت واگذاری واحدهای ساختمانی</h3>
                
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => {
                      setIsAddingSingleUnit(!isAddingSingleUnit);
                      setIsBatchGenerating(false);
                      setIsAddingProj(false);
                      setIsEditingProj(false);
                    }}
                    className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[10px] font-bold border border-teal-150 transition-colors cursor-pointer"
                  >
                    ➕ افزودن تک واحد
                  </button>
                  <button 
                    onClick={() => {
                      setIsBatchGenerating(!isBatchGenerating);
                      setIsAddingSingleUnit(false);
                      setIsAddingProj(false);
                      setIsEditingProj(false);
                    }}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-150 transition-colors cursor-pointer"
                  >
                    ⚡ ابزار بلوک‌بندی
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {projUnits.length === 0 ? (
                  <div className="col-span-full text-center py-8 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs font-light">
                    هیچ واحدی برای این پروژه تعریف نشده است. می‌توانید با «ابزار بلوک‌بندی» یا «افزودن تک واحد» آنها را ثبت کنید.
                  </div>
                ) : (
                  projUnits.map(unit => {
                    // Status colors
                    let colorClasses = "border-slate-100 hover:border-slate-300 bg-white text-slate-700";
                    let badgeText = "آماده فروش";
                    let badgeClass = "bg-slate-100 text-slate-600";

                    if (unit.status === "sold") {
                      colorClasses = "border-emerald-100 bg-emerald-50/10 hover:border-emerald-300 text-emerald-800";
                      badgeText = "فروخته شده";
                      badgeClass = "bg-emerald-100 text-emerald-700";
                    } else if (unit.status === "pre_sold") {
                      colorClasses = "border-sky-100 bg-sky-50/10 hover:border-sky-300 text-sky-800";
                      badgeText = "پیش‌فروش";
                      badgeClass = "bg-sky-100 text-sky-700";
                    } else if (unit.status === "bartered") {
                      colorClasses = "border-amber-100 bg-amber-50/10 hover:border-amber-300 text-amber-800";
                      badgeText = "تهاتر شده";
                      badgeClass = "bg-amber-100 text-amber-700";
                    }

                    // Calculate unit total expenses
                    const unitExpensesSum = unit.specificExpenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

                    return (
                      <div 
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-sm ${
                          selectedUnit?.id === unit.id ? "ring-2 ring-teal-500 scale-[0.98] shadow-md" : ""
                        } ${colorClasses}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-extrabold text-slate-900 block">واحد {toFarsiDigits(unit.unitNumber)}</span>
                            <p className="text-[10px] text-slate-500 font-light mt-0.5 font-sans">
                              طبقه {unit.floor === "0" ? "همکف" : toFarsiDigits(unit.floor)} | {toFarsiDigits(unit.area)} متر
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </div>

                        <div className="border-t border-slate-100/80 pt-2 flex justify-between items-center text-[10px] font-medium">
                          <span className="text-slate-400">مخارج سفارشی:</span>
                          <span className="font-extrabold text-slate-700 font-mono">{formatRials(unitExpensesSum)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Selected Unit Detail Panel */}
            {selectedUnit && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-slate-150 shadow-md space-y-5"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <h4 className="font-extrabold text-slate-800 text-xs">
                      جزئیات و عملیات مالی واحد {toFarsiDigits(selectedUnit.unitNumber)}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-light">
                      (متراژ: {toFarsiDigits(selectedUnit.area)} مترمربع)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Edit Core Physical Properties Button */}
                    <button
                      type="button"
                      onClick={() => setIsEditingPhysicalProps(!isEditingPhysicalProps)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        isEditingPhysicalProps
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-sm"
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isEditingPhysicalProps ? "لغو ویرایش مشخصات" : "ویرایش مشخصات فیزیکی"}
                    </button>

                    {/* Delete Unit Button with 2-step confirmation */}
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
                          title="حذف کامل واحد مسکونی"
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
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer px-1"
                    >
                      بستن ×
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Left Column: Physical Properties Editing OR Pre-sales & Barter registration */}
                  {isEditingPhysicalProps ? (
                    <div className="space-y-4 border-l border-slate-100 pl-6">
                      <h5 className="font-extrabold text-indigo-700 flex items-center gap-1">
                        <Edit3 className="w-4 h-4 text-indigo-500" />
                        ویرایش مشخصات فیزیکی واحد مسکونی
                      </h5>

                      <form onSubmit={handleSavePhysicalProps} className="space-y-3 font-medium text-slate-600">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">شماره واحد</label>
                          <input 
                            type="text" 
                            placeholder="مثال: ۱۰۱"
                            value={editUnitNumber}
                            onChange={e => setEditUnitNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">طبقه</label>
                          <input 
                            type="text" 
                            placeholder="مثال: ۱"
                            value={editUnitFloor}
                            onChange={e => setEditUnitFloor(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">متراژ واحد (مترمربع)</label>
                          <input 
                            type="number" 
                            placeholder="مثال: ۹۵"
                            value={editUnitArea}
                            onChange={e => setEditUnitArea(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900 font-mono text-center font-bold"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">قیمت پایه هر متر مربع (ریال)</label>
                          <FormattedAmountInput 
                            value={editUnitPricePerMeter}
                            onChange={setEditUnitPricePerMeter}
                            placeholder="مثال: ۳۵,۰۰۰,۰۰۰"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900 font-mono text-center font-bold"
                          />
                        </div>

                        <div className="pt-2">
                          <button 
                            type="submit"
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors cursor-pointer text-xs"
                          >
                            ذخیره تغییرات فیزیکی واحد
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-4 border-l border-slate-100 pl-6">
                      <h5 className="font-extrabold text-slate-700 flex items-center gap-1">
                        <Coins className="w-4 h-4 text-teal-500" />
                        وضعیت واگذاری و پیش‌فروش واحد
                      </h5>

                      <form onSubmit={handleSaveSale} className="space-y-3 font-medium text-slate-600">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">نوع واگذاری</label>
                          <select 
                            value={saleStatus}
                            onChange={e => setSaleStatus(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                          >
                            <option value="available">موجود و آماده واگذاری</option>
                            <option value="pre_sold">پیش‌فروش شده</option>
                            <option value="sold">فروخته شده قطعی</option>
                            <option value="bartered">واگذار شده بابت تهاتر با مصالح/خدمات</option>
                          </select>
                        </div>

                        {saleStatus !== "available" && saleStatus !== "any" && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 block">نام خریدار / پیمانکار طرف تهاتر <span className="text-rose-500">*</span></label>
                            <input 
                              type="text" 
                              placeholder="مثال: آقای مهندس حسینی"
                              value={buyerName}
                              onChange={e => setBuyerName(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900"
                              required
                            />
                          </div>
                        )}

                        {(saleStatus === "pre_sold" || saleStatus === "sold") && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 block">مبلغ پیش‌دریافت نقدی (ریال) <span className="text-rose-500">*</span></label>
                            <input 
                              type="number" 
                              placeholder="کل وجه نقد دریافتی"
                              value={downPayment}
                              onChange={e => setDownPayment(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-slate-900"
                              required
                            />
                          </div>
                        )}

                        {saleStatus === "bartered" && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 block">جزئیات اقلام، مصالح یا آهن‌آلات تهاتر شده <span className="text-rose-500">*</span></label>
                            <textarea 
                              placeholder="مثال: تهاتر با ۷۰ تن اسکلت فلزی پیچ و مهره ساختمان"
                              value={barterProperty}
                              onChange={e => setBarterProperty(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none h-16 resize-none text-slate-900"
                              required
                            />
                          </div>
                        )}

                        <button 
                          type="submit"
                          className="w-full py-2.5 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors cursor-pointer text-xs"
                        >
                          ثبت و ذخیره وضعیت واگذاری واحد
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Right: Specific Unit Expenses */}
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-slate-700 flex items-center gap-1">
                      <Calculator className="w-4 h-4 text-amber-500" />
                      مخارج و نصبیات اختصاصی این واحد (مبلمان، پکیج، شیرآلات و...)
                    </h5>

                    {/* Expenses list */}
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                      {selectedUnit.specificExpenses.length === 0 ? (
                        <p className="text-slate-400 font-light italic py-4 text-center">تاکنون هیچ هزینه اختصاصی مازادی برای این واحد ثبت نشده است.</p>
                      ) : (
                        selectedUnit.specificExpenses.map(exp => (
                          <div key={exp.id} className="p-2.5 bg-rose-50/40 border border-rose-100 rounded-lg flex justify-between items-center text-[10px]">
                            <span className="text-slate-700 font-bold">{exp.title}</span>
                            <span className="text-rose-600 font-black font-mono">{formatRials(exp.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add expense form */}
                    <form onSubmit={handleSaveUnitExpense} className="space-y-2.5 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="عنوان مخرج (پارکت، کابینت...)"
                          value={unitExpTitle}
                          onChange={e => setUnitExpTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="مبلغ هزینه (ریال)"
                          value={unitExpAmount}
                          onChange={e => setUnitExpAmount(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                          required
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors cursor-pointer text-[10px]"
                      >
                        ثبت هزینه سفارشی روی حساب این واحد
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
