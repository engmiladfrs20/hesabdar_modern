import React, { useState, useEffect } from "react";
import { Material, MaterialTransaction, Project } from "../types";
import { getTodayShamsiString } from "../utils/shamsi";
import { toEnglishDigits } from "../utils/digits";
import { Package, Search, Plus, ArrowUpRight, ArrowDownRight, Archive, Tag, ClipboardList, Layers, HelpCircle, Edit, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { CONSTRUCTION_STAGES } from "../data/constructionStages";
import { PREDEFINED_MATERIALS, PredefinedMaterial } from "../data/predefinedMaterials";
import { FormattedAmountInput } from "./FormattedAmountInput";

interface WarehouseManagerProps {
  materials: Material[];
  materialTransactions: MaterialTransaction[];
  projects: Project[];
  onAddMaterial: (mat: Partial<Material>) => void;
  onAddWarehouseTx: (tx: Partial<MaterialTransaction>) => void;
  onDeleteMaterial?: (id: string, isTransaction: boolean) => void;
}

export default function WarehouseManager({ 
  materials, 
  materialTransactions, 
  projects, 
  onAddMaterial, 
  onAddWarehouseTx,
  onDeleteMaterial
}: WarehouseManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"inventory" | "transactions">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isAddingTx, setIsAddingTx] = useState(false);

  // Pre-defined template selector state
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");

  // Extended Material form state
  const [matName, setMatName] = useState("");
  const [matCategory, setMatCategory] = useState("اسکلت بتنی");
  const [matUnit, setMatUnit] = useState("تن");
  const [matStock, setMatStock] = useState("");
  const [matPrice, setMatPrice] = useState(""); // Average Price
  const [matCode, setMatCode] = useState("");
  const [matSubCategory, setMatSubCategory] = useState("");
  const [matSecondaryUnit, setMatSecondaryUnit] = useState("");
  const [matConversionFactor, setMatConversionFactor] = useState("");
  const [matConsumptionType, setMatConsumptionType] = useState<"concrete" | "steel" | "common">("common");
  const [matMinStock, setMatMinStock] = useState("");
  const [matPurchasePrice, setMatPurchasePrice] = useState("");

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // New Warehouse Tx form state
  const [txProjId, setTxProjId] = useState(projects[0]?.id || "");
  const [txMatId, setTxMatId] = useState(materials[0]?.id || "");
  const [txType, setTxType] = useState<"in" | "out">("in");
  const [txQty, setTxQty] = useState("");
  const [txPrice, setTxPrice] = useState("");
  const [txPerson, setTxPerson] = useState("");
  const [txDesc, setTxDesc] = useState("");

  useEffect(() => {
    if (projects.length > 0 && (!txProjId || !projects.some(p => p.id === txProjId))) {
      setTxProjId(projects[0].id);
    }
  }, [projects, txProjId]);

  useEffect(() => {
    if (materials.length > 0 && (!txMatId || !materials.some(m => m.id === txMatId))) {
      setTxMatId(materials[0].id);
    }
  }, [materials, txMatId]);

  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const handleTemplateChange = (code: string) => {
    setSelectedTemplateCode(code);
    const tmpl = PREDEFINED_MATERIALS.find(t => t.code === code);
    if (tmpl) {
      setMatName(tmpl.name);
      setMatCategory(tmpl.category);
      setMatUnit(tmpl.unit);
      setMatCode(tmpl.code);
      setMatSubCategory(tmpl.subCategory || "");
      setMatSecondaryUnit(tmpl.secondaryUnit || "");
      setMatConversionFactor(tmpl.conversionFactor ? String(tmpl.conversionFactor) : "");
      setMatConsumptionType(tmpl.consumptionType);
    }
  };

  const handleEditMaterialClick = (mat: Material) => {
    setEditingMaterialId(mat.id);
    setMatName(mat.name);
    setMatCategory(mat.category);
    setMatUnit(mat.unit);
    setMatStock(mat.stock.toString());
    setMatPrice(mat.averagePrice.toString());
    setMatCode(mat.code || "");
    setMatSubCategory(mat.subCategory || "");
    setMatSecondaryUnit(mat.secondaryUnit || "");
    setMatConversionFactor(mat.conversionFactor ? mat.conversionFactor.toString() : "");
    setMatConsumptionType(mat.consumptionType || "common");
    setMatMinStock(mat.minStock ? mat.minStock.toString() : "");
    setMatPurchasePrice(mat.purchasePrice ? mat.purchasePrice.toString() : "");
    setIsAddingMaterial(true);
  };

  const handleEditTxClick = (tx: MaterialTransaction) => {
    setEditingTxId(tx.id);
    setTxProjId(tx.projectId);
    setTxMatId(tx.materialId);
    setTxType(tx.type);
    setTxQty(tx.quantity.toString());
    setTxPrice(tx.unitPrice ? tx.unitPrice.toString() : "");
    setTxPerson(tx.personName || "");
    setTxDesc(tx.description || "");
    setIsAddingTx(true);
  };

  const handleSubmitMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName) return;

    onAddMaterial({
      id: editingMaterialId || undefined,
      name: matName,
      category: matCategory,
      unit: matUnit,
      stock: Number(matStock || 0),
      averagePrice: Number(matPrice || 0),
      code: matCode || undefined,
      subCategory: matSubCategory || undefined,
      secondaryUnit: matSecondaryUnit || undefined,
      conversionFactor: matConversionFactor ? Number(matConversionFactor) : undefined,
      consumptionType: matConsumptionType,
      minStock: matMinStock ? Number(matMinStock) : undefined,
      purchasePrice: matPurchasePrice ? Number(matPurchasePrice) : undefined
    });

    setMatName("");
    setMatStock("");
    setMatPrice("");
    setMatCode("");
    setMatSubCategory("");
    setMatSecondaryUnit("");
    setMatConversionFactor("");
    setMatConsumptionType("common");
    setMatMinStock("");
    setMatPurchasePrice("");
    setSelectedTemplateCode("");
    setEditingMaterialId(null);
    setIsAddingMaterial(false);
  };

  const handleSubmitTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txQty) return;

    onAddWarehouseTx({
      id: editingTxId || undefined,
      projectId: txProjId,
      materialId: txMatId,
      type: txType,
      quantity: Number(txQty),
      unitPrice: Number(txPrice || 0),
      personName: txPerson,
      description: txDesc,
      date: getTodayShamsiString()
    });

    setTxQty("");
    setTxPrice("");
    setTxPerson("");
    setTxDesc("");
    setEditingTxId(null);
    setIsAddingTx(false);
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Header Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">انبار مرکزی و کاردکس مصالح</h2>
            <p className="text-slate-400 text-xs font-light">گروه‌بندی کالاها و مصالح ساختمانی، گزارشات ورود، خروج و مانده انبار پروژه‌ها</p>
          </div>
        </div>

        {/* Sub Nav */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium self-stretch md:self-auto">
          <button 
            onClick={() => setActiveSubTab("inventory")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubTab === "inventory" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            موجودی کالا و انبار
          </button>
          <button 
            onClick={() => setActiveSubTab("transactions")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubTab === "transactions" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            دفتر کاردکس مصالح
          </button>
        </div>
      </div>

      {/* Tab 1: Inventory List */}
      {activeSubTab === "inventory" && (
        <div className="space-y-4">
          
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="جستجوی مصالح و دسته‌بندی..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 px-3 py-1.5 pr-8 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5" />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                تعریف کالای جدید
              </button>
              <button 
                onClick={() => setIsAddingTx(!isAddingTx)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                ثبت حواله ورود/خروج انبار
              </button>
            </div>
          </div>

          {/* New Material Modal */}
          {isAddingMaterial && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-xl border border-slate-150 shadow-md space-y-6 text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800 text-sm">تعریف کالا و مصالح با فیلدهای تخصصی حسابداری ساختمانی</h4>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">حسابداری دقیق انبار پروژه‌ها</span>
              </div>

              {/* Template Picker */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <label className="text-slate-700 font-extrabold flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" />
                  انتخاب سریع از لیست مصالح استاندارد کارگاه (۱۵ گروه اصلی):
                </label>
                <select
                  value={selectedTemplateCode}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-sans"
                >
                  <option value="">-- انتخاب الگوی کالا و بارگذاری خودکار فیلدها --</option>
                  {Object.entries(
                    PREDEFINED_MATERIALS.reduce((acc, current) => {
                      if (!acc[current.category]) {
                        acc[current.category] = [];
                      }
                      acc[current.category].push(current);
                      return acc;
                    }, {} as Record<string, typeof PREDEFINED_MATERIALS[0][]>)
                  ).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.code} - {item.name} ({item.unit})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-slate-400 text-[10px]">
                  انتخاب هر یک از مصالح بالا باعث پر شدن اتوماتیک فیلدهای کد کالا، نام، گروه، واحد اصلی، واحد فرعی و نوع مصرف کالا می‌شود. همچنین می‌توانید تغییرات سفارشی اعمال کنید.
                </p>
              </div>

              <form onSubmit={handleSubmitMaterial} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Code */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">کد کالا</label>
                    <input 
                      type="text" 
                      placeholder="مثال: MAT-001"
                      value={matCode}
                      onChange={e => setMatCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-slate-600 font-bold">نام کالا/مصالح *</label>
                    <input 
                      type="text" 
                      placeholder="مثال: سیمان تیپ ۲ ساوه"
                      value={matName}
                      onChange={e => setMatName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-semibold"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">گروه کالا</label>
                    <select 
                      value={matCategory}
                      onChange={e => setMatCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    >
                      {CONSTRUCTION_STAGES.map(cat => (
                        <option key={cat.id} value={cat.name.replace(/^\d+\.\s*/, "")}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="سایر مصالح عمومی">سایر مصالح عمومی</option>
                    </select>
                  </div>

                  {/* SubCategory */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">زیرگروه کالا</label>
                    <input 
                      type="text" 
                      placeholder="مثال: تیرچه کرومیت / میلگرد ۱۶"
                      value={matSubCategory}
                      onChange={e => setMatSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Main Unit */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">واحد اصلی اندازه‌گیری *</label>
                    <input 
                      type="text" 
                      placeholder="مثال: کیسه، تن، متر مکعب، کیلوگرم"
                      value={matUnit}
                      onChange={e => setMatUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  {/* Secondary Unit */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">واحد فرعی اندازه‌گیری (اختیاری)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: شاخه، پاکت"
                      value={matSecondaryUnit}
                      onChange={e => setMatSecondaryUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Conversion Factor */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">ضریب تبدیل واحد فرعی به اصلی</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="مثال: ۲۵ (۲۵ کیسه در هر تن)"
                      value={matConversionFactor}
                      onChange={e => setMatConversionFactor(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ""))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Consumption Type */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">نوع مصرف</label>
                    <select 
                      value={matConsumptionType}
                      onChange={e => setMatConsumptionType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    >
                      <option value="common">مشترک (عمومی)</option>
                      <option value="concrete">بتنی</option>
                      <option value="steel">فلزی</option>
                    </select>
                  </div>

                  {/* Initial Stock */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">موجودی انبار اولیه</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="مثال: ۱۰۰"
                      value={matStock}
                      onChange={e => setMatStock(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ""))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Min Stock */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">حداقل موجودی مجاز (آلارم کسری انبار)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="مثال: ۱۰"
                      value={matMinStock}
                      onChange={e => setMatMinStock(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ""))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Last Purchase Price */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">نرخ خرید پایه (ریال)</label>
                    <FormattedAmountInput 
                      placeholder="مثال: ۸۵,۰۰۰"
                      value={matPurchasePrice}
                      onChange={setMatPurchasePrice}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Average Price */}
                  <div className="space-y-1.5">
                    <label className="text-slate-600 font-bold">نرخ میانگین پایه کالا (ریال)</label>
                    <FormattedAmountInput 
                      placeholder="مثال: ۸۲,۰۰۰"
                      value={matPrice}
                      onChange={setMatPrice}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="submit" 
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer transition-all shadow-sm"
                  >
                    ثبت و ذخیره در سیستم انبارداری
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddingMaterial(false);
                      setSelectedTemplateCode("");
                    }}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* New Warehouse Transaction Modal */}
          {isAddingTx && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-xl border border-slate-150 shadow-md space-y-4 text-xs"
            >
              <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">ثبت قبض انبار (ورود مصالح به کارگاه یا خروج به پروژه)</h4>
              <form onSubmit={handleSubmitTx} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">پروژه تحویل‌گیرنده</label>
                  <select 
                    value={txProjId}
                    onChange={e => setTxProjId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">انتخاب مصالح</label>
                  <select 
                    value={txMatId}
                    onChange={e => setTxMatId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">نوع حواله</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setTxType("in")}
                      className={`py-1.5 rounded-lg border text-center font-bold ${txType === "in" ? "bg-emerald-500 text-white border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                    >
                      ورود به انبار (خرید)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setTxType("out")}
                      className={`py-1.5 rounded-lg border text-center font-bold ${txType === "out" ? "bg-rose-500 text-white border-rose-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                    >
                      خروج به کارگاه (مصرف)
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">مقدار / تعداد</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="مثال: ۵۰"
                    value={txQty}
                    onChange={e => setTxQty(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ""))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">قیمت فی هر واحد (ریال - برای ورود)</label>
                  <FormattedAmountInput 
                    placeholder="فی هر واحد"
                    value={txPrice}
                    onChange={setTxPrice}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">مسئول تحویل‌دهنده / تحویل‌گیرنده</label>
                  <input 
                    type="text" 
                    placeholder="نام شخص"
                    value={txPerson}
                    onChange={e => setTxPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-slate-500 font-medium">شرح حواله انبار</label>
                  <input 
                    type="text" 
                    placeholder="شرح مصرف یا منبع خرید مصالح"
                    value={txDesc}
                    onChange={e => setTxDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
                <div className="col-span-full flex justify-end gap-2">
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium cursor-pointer"
                  >
                    ثبت حواله
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingTx(false)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Inventory Grid cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredMaterials.map(mat => {
              const totalAssetVal = mat.stock * mat.averagePrice;
              const isLowStock = mat.minStock !== undefined && mat.stock < mat.minStock;

              return (
                <div key={mat.id} className={`p-4 bg-white border rounded-xl flex flex-col justify-between shadow-sm space-y-3 transition-all hover:shadow-md ${isLowStock ? 'border-rose-200 bg-rose-50/10' : 'border-slate-150'}`}>
                  
                  {/* Top tags / labels */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                        {mat.category}
                      </span>
                      {mat.code && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-full font-mono">
                          {mat.code}
                        </span>
                      )}
                      {mat.consumptionType === "concrete" && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          بتنی
                        </span>
                      )}
                      {mat.consumptionType === "steel" && (
                        <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">
                          فلزی
                        </span>
                      )}
                    </div>
                    <div className={`p-1.5 rounded-lg ${isLowStock ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                      <Archive className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Body Title and SubCategory */}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-800 text-xs">{mat.name}</h4>
                    {mat.subCategory && (
                      <p className="text-[10px] text-slate-400 font-light">زیرگروه: {mat.subCategory}</p>
                    )}
                  </div>

                  {/* Secondary Unit & Conversion Factor */}
                  {mat.secondaryUnit && (
                    <div className="bg-slate-50/80 p-2 rounded-lg text-[10px] text-slate-500 space-y-0.5 border border-slate-100">
                      <div>واحد فرعی: <span className="font-bold text-slate-700">{mat.secondaryUnit}</span></div>
                      {mat.conversionFactor && (
                        <div>ضریب تبدیل: <span className="font-mono text-slate-700">۱ {mat.unit} = {toFarsiDigits(mat.conversionFactor)} {mat.secondaryUnit}</span></div>
                      )}
                    </div>
                  )}

                  {/* Stocks & Alerts */}
                  <div className="border-t border-slate-100/80 pt-2 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block font-light">موجودی انبار:</span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          {toFarsiDigits(mat.stock)} {mat.unit}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-slate-400 text-[10px] block font-light">ارزش موجودی:</span>
                        <span className="font-bold text-amber-600">
                          {formatTomans(totalAssetVal)}
                        </span>
                      </div>
                    </div>

                    {/* Low Stock Warning */}
                    {isLowStock && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-700 p-1.5 rounded-lg text-[10px] font-bold flex justify-between items-center">
                        <span>⚠️ آلارم کسری انبار!</span>
                        <span>حداقل مجاز: {toFarsiDigits(mat.minStock || 0)} {mat.unit}</span>
                      </div>
                    )}
                  </div>

                  {/* Pricing Details */}
                  {(mat.purchasePrice !== undefined || mat.averagePrice !== undefined) && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-50 text-[10px] text-slate-500">
                      {mat.purchasePrice !== undefined && (
                        <div>
                          <span className="block text-slate-400 text-[9px]">آخرین نرخ خرید:</span>
                          <span className="font-medium text-slate-700">{formatTomans(mat.purchasePrice)}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-slate-400 text-[9px]">نرخ میانگین کالا:</span>
                        <span className="font-medium text-slate-700">{formatTomans(mat.averagePrice)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleEditMaterialClick(mat)}
                      className="p-1 px-2 hover:bg-slate-50 rounded text-slate-500 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
                      title="ویرایش کالا"
                    >
                      <Edit className="w-3 h-3" />
                      ویرایش
                    </button>
                    {onDeleteMaterial && (
                      <button
                        onClick={() => onDeleteMaterial(mat.id, false)}
                        className="p-1 px-2 hover:bg-slate-50 rounded text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
                        title="حذف کالا"
                      >
                        <Trash2 className="w-3 h-3" />
                        حذف
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Cardex Log */}
      {activeSubTab === "transactions" && (
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
                  <th className="p-4">تاریخ</th>
                  <th className="p-4">کالا / مصالح</th>
                  <th className="p-4">پروژه کارگاهی</th>
                  <th className="p-4">نوع حواله</th>
                  <th className="p-4">تحویل‌گیرنده/دهنده</th>
                  <th className="p-4 text-center">تعداد / مقدار</th>
                  <th className="p-4 text-left">فی واحد (ریال)</th>
                  <th className="p-4">توضیحات</th>
                  <th className="p-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {materialTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 font-light text-sm">هیچ حواله ورود یا خروجی ثبت نشده است.</td>
                  </tr>
                ) : (
                  materialTransactions.map(tx => {
                    const mat = materials.find(m => m.id === tx.materialId);
                    const proj = projects.find(p => p.id === tx.projectId);
                    const isIn = tx.type === "in";

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 font-mono font-medium text-slate-500">{toFarsiDigits(tx.date)}</td>
                        <td className="p-4 font-semibold text-slate-800">{mat?.name || "کالای حذف شده"}</td>
                        <td className="p-4 font-light text-slate-600">{proj?.name || "عمومی"}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] flex items-center gap-0.5 w-fit ${
                            isIn ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                          }`}>
                            {isIn ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isIn ? "ورود به انبار" : "خروج از انبار"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-light">{tx.personName}</td>
                        <td className="p-4 text-center font-bold text-slate-800">
                          {toFarsiDigits(tx.quantity)} {mat?.unit}
                        </td>
                        <td className="p-4 text-left font-semibold text-slate-700">
                          {tx.unitPrice > 0 ? formatTomans(tx.unitPrice) : "—"}
                        </td>
                        <td className="p-4 max-w-[180px] truncate font-light text-slate-500">{tx.description}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditTxClick(tx)}
                              className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                              title="ویرایش حواله"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteMaterial && (
                              <button
                                type="button"
                                onClick={() => onDeleteMaterial(tx.id, true)}
                                className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="حذف حواله"
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
      )}
    </div>
  );
}
