import React, { useState, useEffect } from "react";
import {
  Project,
  ProjectBlockConfig,
  FloorUnitConfig,
  UnitNumberingStyle,
  ProjectStageBranch,
  Transaction,
  UnitItem,
  Contact,
  PreSale
} from "../types";
import { formatRials, toFarsiDigits } from "../utils/shamsi";
import { toEnglishDigits } from "../utils/digits";
import { FormattedAmountInput } from "./FormattedAmountInput";
import {
  DEFAULT_PROJECT_STAGE_TREE,
  getProjectEffectiveStageTree,
  saveGlobalStageTree,
  flattenStageTreeToStrings
} from "../data/constructionStages";
import { printStructuredReport } from "../utils/printReport";
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
  FileText,
  X,
  Grid,
  Copy,
  Search,
  Filter,
  Printer,
  ChevronDown,
  ChevronLeft,
  FolderTree,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

type BlockNamingPattern = "english" | "persian" | "numeric" | "directional" | "none";

function getAutoBlockName(index: number, pattern: BlockNamingPattern, totalBlocks: number): string {
  if (pattern === "none") return "";
  const en = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const fa = ["الف", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ی"];
  const dir = ["شمالی", "جنوبی", "شرقی", "غربی", "مرکزی", "غربی ۲"];
  if (pattern === "english") return en[index] || `B${index + 1}`;
  if (pattern === "persian") return fa[index] || `بلوک ${index + 1}`;
  if (pattern === "directional") return dir[index] || `بلوک ${index + 1}`;
  if (pattern === "numeric") return String(index + 1);
  return totalBlocks >= 1 ? (en[index] || String(index + 1)) : "";
}

function buildDefaultFloorConfigs(
  floorsAboveGround: number,
  groundFloorUnits: number,
  defaultUpperFloorUnits: number,
  existingConfigs?: FloorUnitConfig[]
): FloorUnitConfig[] {
  const existingMap = new Map<number, number>();
  if (Array.isArray(existingConfigs)) {
    existingConfigs.forEach(fc => existingMap.set(fc.floorNumber, fc.unitsCount));
  }

  const list: FloorUnitConfig[] = [];
  // Floor 0 = Ground Floor (طبقه همکف)
  list.push({
    floorNumber: 0,
    unitsCount: existingMap.has(0) ? existingMap.get(0)! : Math.max(0, groundFloorUnits)
  });

  for (let f = 1; f <= Math.max(0, floorsAboveGround); f++) {
    list.push({
      floorNumber: f,
      unitsCount: existingMap.has(f) ? existingMap.get(f)! : Math.max(0, defaultUpperFloorUnits)
    });
  }

  return list;
}

function createInitialBlockConfig(name: string): ProjectBlockConfig {
  const floors = 4;
  const groundFloorUnits = 2;
  const unitsPerFloor = 4;
  const floorConfigs = buildDefaultFloorConfigs(floors, groundFloorUnits, unitsPerFloor);
  const totalUnits = floorConfigs.reduce((s, f) => s + f.unitsCount, 0);
  return {
    name,
    floors,
    groundFloorUnits,
    unitsPerFloor,
    floorConfigs,
    totalUnits
  };
}

function formatUnitCode(
  blockName: string,
  floorNum: number,
  posInFloor: number,
  seqInBlock: number,
  globalSeq: number,
  totalBlocksCount: number,
  numberingStyle: UnitNumberingStyle
): string {
  const bName = (blockName || "").trim();
  if (numberingStyle === "block_floor_unit_short") {
    // e.g. Block A, Ground floor (0), Unit 1 -> A01 | Block A, Floor 1, Unit 1 -> A11
    return bName ? `${bName}${floorNum}${posInFloor}` : `${floorNum}${posInFloor}`;
  }
  if (numberingStyle === "block_seq_padded") {
    // e.g. A01, A02, A03, A04...
    const padded = String(seqInBlock).padStart(2, "0");
    return bName ? `${bName}${padded}` : padded;
  }
  if (numberingStyle === "block_unit") {
    const floorUnitCode = floorNum === 0 ? `0${posInFloor}` : String(floorNum * 100 + posInFloor);
    return bName ? `${bName}-${floorUnitCode}` : floorUnitCode;
  }
  if (numberingStyle === "floor_unit") {
    return floorNum === 0 ? `0${posInFloor}` : String(floorNum * 100 + posInFloor);
  }
  // sequential
  return bName && totalBlocksCount > 1 ? `${bName}-${seqInBlock}` : String(globalSeq);
}

function buildGeneratedUnitsFromBlocks(
  blocks: ProjectBlockConfig[],
  numberingStyle: UnitNumberingStyle
): Array<{ unitNumber: string; blockName: string; floor: string }> {
  const result: Array<{ unitNumber: string; blockName: string; floor: string }> = [];
  let globalSeq = 0;

  blocks.forEach(blk => {
    const bName = (blk.name || "").trim();
    const floorConfigs: FloorUnitConfig[] =
      Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0
        ? blk.floorConfigs
        : buildDefaultFloorConfigs(
            blk.floors ?? 4,
            blk.groundFloorUnits ?? 2,
            blk.unitsPerFloor ?? 4
          );

    let seqInBlock = 0;
    floorConfigs.forEach(fc => {
      const count = Math.max(0, Number(fc.unitsCount) || 0);
      for (let pos = 1; pos <= count; pos++) {
        seqInBlock++;
        globalSeq++;
        const unitNumber = formatUnitCode(
          bName,
          fc.floorNumber,
          pos,
          seqInBlock,
          globalSeq,
          blocks.length,
          numberingStyle
        );
        result.push({
          unitNumber,
          blockName: bName,
          floor: String(fc.floorNumber)
        });
      }
    });
  });

  return result;
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
  const [activeBlockFilter, setActiveBlockFilter] = useState<string>("ALL");

  const [projDeleteConfirm, setProjDeleteConfirm] = useState<number>(0);
  const [unitDeleteConfirm, setUnitDeleteConfirm] = useState<number>(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // New project form states + Automatic Block & Per-Floor Structuring
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [projName, setProjName] = useState("");
  const [projAddress, setProjAddress] = useState("");
  const [projArea, setProjArea] = useState("");
  const [projBudget, setProjBudget] = useState("");
  const [projSupervisor, setProjSupervisor] = useState("مهندس میلاد فرخی");

  // Auto-Block states for new project (Default: Block A, Ground Floor = 2 units, 4 Upper Floors = 4 units each, Style = A01, A02, A11...)
  const [numBlocks, setNumBlocks] = useState<number>(1);
  const [blockNamingPattern, setBlockNamingPattern] = useState<BlockNamingPattern>("english");
  const [numberingStyle, setNumberingStyle] = useState<UnitNumberingStyle>("block_floor_unit_short");
  const [blocksConfig, setBlocksConfig] = useState<ProjectBlockConfig[]>([
    createInitialBlockConfig("A")
  ]);

  // Edit active project states
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [editProjName, setEditProjName] = useState("");
  const [editProjAddress, setEditProjAddress] = useState("");
  const [editProjArea, setEditProjArea] = useState("");
  const [editProjBudget, setEditProjBudget] = useState("");
  const [editProjSupervisor, setEditProjSupervisor] = useState("");
  const [editProjStage, setEditProjStage] = useState("");
  const [editProjNumUnits, setEditProjNumUnits] = useState("");
  const [editNumberingStyle, setEditNumberingStyle] = useState<UnitNumberingStyle>("block_floor_unit_short");
  const [editBlocksConfig, setEditBlocksConfig] = useState<ProjectBlockConfig[]>([]);
  const [syncBlocksOnSave, setSyncBlocksOnSave] = useState<boolean>(true);

  // Hierarchical Project Stage Tree States (Requirement 7)
  const [stageTree, setStageTree] = useState<ProjectStageBranch[]>(DEFAULT_PROJECT_STAGE_TREE);
  const [expandedStageBranches, setExpandedStageBranches] = useState<Record<string, boolean>>({ stage_1: true, stage_2: true });
  const [isStageManagerOpen, setIsStageManagerOpen] = useState<boolean>(false);
  const [newBranchName, setNewBranchName] = useState<string>("");
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchTitle, setEditingBranchTitle] = useState<string>("");
  const [newSubStageInputs, setNewSubStageInputs] = useState<Record<string, string>>({});
  const [editingSubStageId, setEditingSubStageId] = useState<string | null>(null);
  const [editingSubStageTitle, setEditingSubStageTitle] = useState<string>("");

  // Search & Advanced Filter States for Units & Projects (Requirement 2)
  const [unitSearchQuery, setUnitSearchQuery] = useState<string>("");
  const [showAdvancedUnitSearch, setShowAdvancedUnitSearch] = useState<boolean>(false);
  const [unitStatusFilter, setUnitStatusFilter] = useState<string>("ALL");
  const [unitFloorFilter, setUnitFloorFilter] = useState<string>("ALL");
  const [unitMinArea, setUnitMinArea] = useState<string>("");
  const [unitMaxArea, setUnitMaxArea] = useState<string>("");
  const [unitMinPrice, setUnitMinPrice] = useState<string>("");
  const [unitMaxPrice, setUnitMaxPrice] = useState<string>("");

  // Add single unit modal states
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

  // Unit Edit Popup Modal States
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

  // Rebuild blocksConfig when numBlocks or blockNamingPattern changes
  const handleUpdateBlockCountOrPattern = (nextCount: number, nextPattern: BlockNamingPattern) => {
    const safeCount = Math.max(1, Math.min(20, nextCount));
    setNumBlocks(safeCount);
    setBlockNamingPattern(nextPattern);

    setBlocksConfig(prev => {
      const updated: ProjectBlockConfig[] = [];
      for (let i = 0; i < safeCount; i++) {
        const existing = prev[i] || prev[0] || createInitialBlockConfig("A");
        const floors = existing.floors ?? 4;
        const groundFloorUnits = existing.groundFloorUnits ?? 2;
        const unitsPerFloor = existing.unitsPerFloor ?? 4;
        const floorConfigs = buildDefaultFloorConfigs(
          floors,
          groundFloorUnits,
          unitsPerFloor,
          existing.floorConfigs
        );
        const totalUnits = floorConfigs.reduce((s, f) => s + f.unitsCount, 0);
        updated.push({
          name: getAutoBlockName(i, nextPattern, safeCount),
          floors,
          groundFloorUnits,
          unitsPerFloor,
          floorConfigs,
          totalUnits
        });
      }
      return updated;
    });
  };

  // Update block-level quick settings (name, upper floors count, ground floor units, or default upper floor units)
  const handleUpdateBlockQuickSetting = (
    idx: number,
    field: "name" | "floors" | "groundFloorUnits" | "unitsPerFloor",
    rawValue: string | number,
    isEditMode = false
  ) => {
    const setter = isEditMode ? setEditBlocksConfig : setBlocksConfig;
    if (isEditMode) setSyncBlocksOnSave(true);

    setter(prev =>
      prev.map((blk, i) => {
        if (i !== idx) return blk;
        if (field === "name") {
          return { ...blk, name: String(rawValue) };
        }
        const numVal = Math.max(0, parseInt(toEnglishDigits(String(rawValue)).replace(/[^\d]/g, ""), 10) || 0);

        let nextFloors = blk.floors ?? 4;
        let nextGround = blk.groundFloorUnits ?? 2;
        let nextUpperDefault = blk.unitsPerFloor ?? 4;
        let nextFloorConfigs = Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0
          ? [...blk.floorConfigs]
          : buildDefaultFloorConfigs(nextFloors, nextGround, nextUpperDefault);

        if (field === "floors") {
          nextFloors = Math.min(40, numVal);
          nextFloorConfigs = buildDefaultFloorConfigs(
            nextFloors,
            nextGround,
            nextUpperDefault,
            nextFloorConfigs
          );
        } else if (field === "groundFloorUnits") {
          nextGround = numVal;
          const hasZero = nextFloorConfigs.some(fc => fc.floorNumber === 0);
          if (hasZero) {
            nextFloorConfigs = nextFloorConfigs.map(fc =>
              fc.floorNumber === 0 ? { ...fc, unitsCount: nextGround } : fc
            );
          } else {
            nextFloorConfigs = [{ floorNumber: 0, unitsCount: nextGround }, ...nextFloorConfigs];
          }
        } else if (field === "unitsPerFloor") {
          nextUpperDefault = numVal;
          // Apply new default to all upper floors (floor >= 1)
          nextFloorConfigs = nextFloorConfigs.map(fc =>
            fc.floorNumber >= 1 ? { ...fc, unitsCount: nextUpperDefault } : fc
          );
        }

        const totalUnits = nextFloorConfigs.reduce((s, fc) => s + (Number(fc.unitsCount) || 0), 0);
        return {
          ...blk,
          floors: nextFloors,
          groundFloorUnits: nextGround,
          unitsPerFloor: nextUpperDefault,
          floorConfigs: nextFloorConfigs,
          totalUnits
        };
      })
    );
  };

  // Update individual floor's unit count inside a block
  const handleUpdateFloorUnitCount = (
    blockIdx: number,
    floorNumber: number,
    newCount: number,
    isEditMode = false
  ) => {
    const safeCount = Math.max(0, newCount);
    const setter = isEditMode ? setEditBlocksConfig : setBlocksConfig;
    if (isEditMode) setSyncBlocksOnSave(true);

    setter(prev =>
      prev.map((blk, i) => {
        if (i !== blockIdx) return blk;
        const baseConfigs =
          Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0
            ? blk.floorConfigs
            : buildDefaultFloorConfigs(blk.floors ?? 4, blk.groundFloorUnits ?? 2, blk.unitsPerFloor ?? 4);

        const nextFloorConfigs = baseConfigs.map(fc =>
          fc.floorNumber === floorNumber ? { ...fc, unitsCount: safeCount } : fc
        );
        const totalUnits = nextFloorConfigs.reduce((s, fc) => s + (Number(fc.unitsCount) || 0), 0);
        return {
          ...blk,
          groundFloorUnits: floorNumber === 0 ? safeCount : blk.groundFloorUnits,
          floorConfigs: nextFloorConfigs,
          totalUnits
        };
      })
    );
  };

  // Copy floor configuration of one block to all other blocks
  const handleCopyBlockFloorsToAll = (sourceIdx: number, isEditMode = false) => {
    const setter = isEditMode ? setEditBlocksConfig : setBlocksConfig;
    if (isEditMode) setSyncBlocksOnSave(true);

    setter(prev => {
      const source = prev[sourceIdx];
      if (!source) return prev;
      return prev.map((blk, i) => {
        if (i === sourceIdx) return blk;
        return {
          ...blk,
          floors: source.floors,
          groundFloorUnits: source.groundFloorUnits,
          unitsPerFloor: source.unitsPerFloor,
          floorConfigs: (source.floorConfigs || []).map(fc => ({ ...fc })),
          totalUnits: source.totalUnits
        };
      });
    });
  };

  const totalConfiguredUnits = blocksConfig.reduce((sum, b) => sum + (Number(b.totalUnits) || 0), 0);
  const previewGeneratedUnits = buildGeneratedUnitsFromBlocks(blocksConfig, numberingStyle);
  const editTotalConfiguredUnits = editBlocksConfig.reduce((sum, b) => sum + (Number(b.totalUnits) || 0), 0);
  const editPreviewGeneratedUnits = buildGeneratedUnitsFromBlocks(editBlocksConfig, editNumberingStyle);

  useEffect(() => {
    setProjDeleteConfirm(0);
    setActiveBlockFilter("ALL");
    if (selectedProj) {
      setEditProjName(selectedProj.name);
      setEditProjAddress(selectedProj.address);
      setEditProjArea(String(selectedProj.totalArea));
      setEditProjBudget(String(selectedProj.budget));
      setEditProjSupervisor((selectedProj as any).supervisorName || "مهندس میلاد فرخی");
      setEditProjStage(selectedProj.currentStage || "تجهیز کارگاه");
      const currentActiveUnitsCount = units.filter(u => u.projectId === selectedProj.id && !u.isDeleted).length;
      setEditProjNumUnits(String(selectedProj.numberOfUnits || currentActiveUnitsCount || ""));
      setEditNumberingStyle(selectedProj.numberingStyle || "block_floor_unit_short");
      const effectiveTree = getProjectEffectiveStageTree(selectedProj);
      setStageTree(effectiveTree);
      if (Array.isArray(selectedProj.blocks) && selectedProj.blocks.length > 0) {
        setEditBlocksConfig(
          selectedProj.blocks.map(b => {
            const fConfigs =
              Array.isArray(b.floorConfigs) && b.floorConfigs.length > 0
                ? b.floorConfigs
                : buildDefaultFloorConfigs(b.floors ?? 4, b.groundFloorUnits ?? 2, b.unitsPerFloor ?? 4);
            return {
              ...b,
              floors: b.floors ?? 4,
              groundFloorUnits: b.groundFloorUnits ?? 2,
              unitsPerFloor: b.unitsPerFloor ?? 4,
              floorConfigs: fConfigs,
              totalUnits: fConfigs.reduce((s, f) => s + f.unitsCount, 0)
            };
          })
        );
      } else {
        setEditBlocksConfig([createInitialBlockConfig("A")]);
      }
      setSyncBlocksOnSave(true);
    }
  }, [selectedProj?.id, units.length]);

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
      setEditUnitFloor(selectedUnit.floor ?? "0");
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

  // Extract unique blocks and floors for filtering
  const uniqueBlockNames: string[] = Array.from(
    new Set(projUnits.map(u => (u.blockName || "").trim()).filter(Boolean))
  );
  const uniqueFloors: string[] = Array.from(
    new Set(projUnits.map(u => String(u.floor ?? "0").trim()))
  ).sort((a, b) => Number(a) - Number(b));

  const filteredProjUnits = projUnits.filter(u => {
    if (activeBlockFilter !== "ALL") {
      if (activeBlockFilter === "NO_BLOCK" && (u.blockName || "").trim() !== "") return false;
      if (activeBlockFilter !== "NO_BLOCK" && (u.blockName || "").trim() !== activeBlockFilter) return false;
    }
    if (unitStatusFilter !== "ALL" && u.status !== unitStatusFilter) return false;
    if (unitFloorFilter !== "ALL" && String(u.floor ?? "0") !== unitFloorFilter) return false;

    const minA = parseFloat(toEnglishDigits(unitMinArea));
    if (!isNaN(minA) && minA > 0 && (u.area || 0) < minA) return false;
    const maxA = parseFloat(toEnglishDigits(unitMaxArea));
    if (!isNaN(maxA) && maxA > 0 && (u.area || 0) > maxA) return false;

    const minP = parseFloat(toEnglishDigits(unitMinPrice));
    if (!isNaN(minP) && minP > 0 && (u.totalPrice || 0) < minP) return false;
    const maxP = parseFloat(toEnglishDigits(unitMaxPrice));
    if (!isNaN(maxP) && maxP > 0 && (u.totalPrice || 0) > maxP) return false;

    if (unitSearchQuery.trim()) {
      const q = toEnglishDigits(unitSearchQuery.trim()).toLowerCase();
      const hay = toEnglishDigits(
        `${u.unitNumber || ""} ${u.blockName || ""} ${u.buyerName || ""} ${u.floor === "0" ? "همکف" : `طبقه ${u.floor}`}`
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handlePrintUnits = (mode: "before_filter" | "after_filter") => {
    const targetList = mode === "before_filter" ? projUnits : filteredProjUnits;
    const statusMap: Record<string, string> = {
      available: "آزاد",
      pre_sold: "پیش‌فروش شده",
      sold: "فروخته شده",
      bartered: "تهاتر شده"
    };
    printStructuredReport({
      title: `گزارش وضعیت واحدهای پروژه «${selectedProj?.name || ""}»`,
      subtitle: mode === "before_filter"
        ? "چاپ کامل تمامی واحدهای پروژه (قبل از اعمال فیلتر)"
        : "چاپ واحدهای منتخب بر اساس جستجو و فیلترهای اعمال‌شده (بعد از فیلتر)",
      filterDescription: mode === "after_filter"
        ? `بلوک: ${activeBlockFilter === "ALL" ? "همه" : activeBlockFilter} | وضعیت: ${unitStatusFilter === "ALL" ? "همه" : (statusMap[unitStatusFilter] || unitStatusFilter)} | طبقه: ${unitFloorFilter === "ALL" ? "همه" : (unitFloorFilter === "0" ? "همکف" : unitFloorFilter)} | عبارت جستجو: ${unitSearchQuery || "بدون محدودیت"}`
        : undefined,
      columns: [
        { header: "ردیف", accessor: r => r.idx },
        { header: "شماره واحد", accessor: r => r.unitNumber },
        { header: "بلوک", accessor: r => r.blockName || "-" },
        { header: "طبقه", accessor: r => (r.floor === "0" ? "همکف (۰)" : `طبقه ${toFarsiDigits(r.floor)}`) },
        { header: "متراژ کل (متر)", accessor: r => toFarsiDigits(r.area || 0) },
        { header: "نرخ هر متر (ریال)", accessor: r => formatRials(r.pricePerMeter || 0) },
        { header: "بهای کل واحد (ریال)", accessor: r => formatRials(r.totalPrice || 0) },
        { header: "وضعیت واگذاری", accessor: r => statusMap[r.status] || r.status },
        { header: "خریدار / طرف حساب", accessor: r => r.buyerName || "-" }
      ],
      rows: targetList.map((u, i) => ({
        ...u,
        idx: toFarsiDigits(i + 1)
      })),
      summaryItems: [
        { label: "تعداد کل واحدهای این گزارش", value: `${toFarsiDigits(targetList.length)} واحد` },
        { label: "واحدهای آزاد", value: `${toFarsiDigits(targetList.filter(u => u.status === "available").length)} واحد` },
        { label: "واحدهای واگذار شده / پیش‌فروش", value: `${toFarsiDigits(targetList.filter(u => u.status !== "available").length)} واحد` },
        { label: "جمع متراژ واحدها", value: `${toFarsiDigits(Number(targetList.reduce((s, u) => s + (u.area || 0), 0).toFixed(2)))} مترمربع` }
      ]
    });
  };

  // Persist Stage Tree changes to both active project and global storage (Requirement 7)
  const persistStageTreeChanges = (nextTree: ProjectStageBranch[], nextCurrentStage?: string) => {
    setStageTree(nextTree);
    saveGlobalStageTree(nextTree);
    if (selectedProj && editProjectFn) {
      const flatStages = flattenStageTreeToStrings(nextTree);
      editProjectFn({
        ...selectedProj,
        stageTree: nextTree,
        stages: flatStages.length > 0 ? flatStages : selectedProj.stages,
        currentStage: nextCurrentStage || selectedProj.currentStage
      });
    }
  };

  const handleAddMainStageBranch = () => {
    if (!newBranchName.trim()) return;
    const newBranch: ProjectStageBranch = {
      id: "stage_" + Date.now(),
      name: newBranchName.trim(),
      iconName: "Layers",
      status: "pending",
      progress: 0,
      subStages: []
    };
    const nextTree = [...stageTree, newBranch];
    setExpandedStageBranches(prev => ({ ...prev, [newBranch.id]: true }));
    setNewBranchName("");
    persistStageTreeChanges(nextTree);
  };

  const handleDeleteMainStageBranch = (branchId: string) => {
    const nextTree = stageTree.filter(b => b.id !== branchId);
    persistStageTreeChanges(nextTree);
  };

  const handleSaveBranchTitle = (branchId: string) => {
    if (!editingBranchTitle.trim()) return;
    const nextTree = stageTree.map(b =>
      b.id === branchId ? { ...b, name: editingBranchTitle.trim() } : b
    );
    setEditingBranchId(null);
    setEditingBranchTitle("");
    persistStageTreeChanges(nextTree);
  };

  const handleAddSubStageItem = (branchId: string) => {
    const text = (newSubStageInputs[branchId] || "").trim();
    if (!text) return;
    const nextTree = stageTree.map((b, bIdx) => {
      if (b.id !== branchId) return b;
      const nextSub = {
        id: `${branchId}_sub_${Date.now()}`,
        name: text,
        code: `${bIdx + 1}.${b.subStages.length + 1}`,
        status: "pending" as const,
        progress: 0
      };
      return {
        ...b,
        subStages: [...b.subStages, nextSub]
      };
    });
    setNewSubStageInputs(prev => ({ ...prev, [branchId]: "" }));
    persistStageTreeChanges(nextTree);
  };

  const handleDeleteSubStageItem = (branchId: string, subId: string) => {
    const nextTree = stageTree.map(b =>
      b.id === branchId
        ? { ...b, subStages: b.subStages.filter(s => s.id !== subId) }
        : b
    );
    persistStageTreeChanges(nextTree);
  };

  const handleSaveSubStageTitle = (branchId: string, subId: string) => {
    if (!editingSubStageTitle.trim()) return;
    const nextTree = stageTree.map(b =>
      b.id === branchId
        ? {
            ...b,
            subStages: b.subStages.map(s =>
              s.id === subId ? { ...s, name: editingSubStageTitle.trim() } : s
            )
          }
        : b
    );
    setEditingSubStageId(null);
    setEditingSubStageTitle("");
    persistStageTreeChanges(nextTree);
  };

  const handleCycleSubStageStatus = (branchId: string, subId: string) => {
    const order: Array<"pending" | "in_progress" | "completed"> = ["pending", "in_progress", "completed"];
    let activatedName: string | undefined;
    const nextTree = stageTree.map(b => {
      if (b.id !== branchId) return b;
      return {
        ...b,
        subStages: b.subStages.map(s => {
          if (s.id !== subId) return s;
          const nextStatus = order[(order.indexOf(s.status || "pending") + 1) % order.length];
          if (nextStatus === "in_progress") activatedName = s.name;
          return {
            ...s,
            status: nextStatus,
            progress: nextStatus === "completed" ? 100 : nextStatus === "in_progress" ? 50 : 0
          };
        })
      };
    });
    persistStageTreeChanges(nextTree, activatedName);
  };

  // Create New Project with Automatic Per-Floor Block Structuring & Unit Numbering
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName || !saveProjectFn) return;

    const generatedUnits = buildGeneratedUnitsFromBlocks(blocksConfig, numberingStyle);
    const flatStages = flattenStageTreeToStrings(stageTree);

    saveProjectFn({
      companyId: activeCompanyId,
      name: projName,
      address: projAddress,
      totalArea: Number(toEnglishDigits(projArea)) || 1000,
      budget: Number(toEnglishDigits(projBudget)) || 0,
      supervisorName: projSupervisor || "مهندس میلاد فرخی",
      stages: flatStages.length > 0 ? flatStages : ["تجهیز کارگاه", "گودبرداری", "فونداسیون", "اسکلت", "سفت‌کاری", "نازک‌کاری", "نما و تحویل"],
      stageTree,
      currentStage: flatStages[0] || "تجهیز کارگاه",
      status: "active",
      numberOfBlocks: blocksConfig.length,
      numberingStyle,
      blocks: blocksConfig,
      numberOfUnits: generatedUnits.length,
      generatedUnits,
      syncBlockUnits: true,
      defaultUnitArea: 0,
      defaultPricePerMeter: 0
    });

    setIsAddingProj(false);
    setProjName("");
    setProjAddress("");
    setProjArea("");
    setProjBudget("");
    setNumBlocks(1);
    setBlockNamingPattern("english");
    setNumberingStyle("block_floor_unit_short");
    setBlocksConfig([createInitialBlockConfig("A")]);
  };

  const handleSaveEditProj = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !editProjName || !editProjectFn) return;

    const generatedUnits = buildGeneratedUnitsFromBlocks(editBlocksConfig, editNumberingStyle);
    const totalFromBlocks = generatedUnits.length;
    const finalUnitCount = totalFromBlocks > 0
      ? totalFromBlocks
      : (Number(toEnglishDigits(editProjNumUnits)) || 0);
    const flatStages = flattenStageTreeToStrings(stageTree);

    editProjectFn({
      ...selectedProj,
      name: editProjName,
      address: editProjAddress,
      totalArea: Number(toEnglishDigits(editProjArea)) || selectedProj.totalArea,
      budget: Number(toEnglishDigits(editProjBudget)) || 0,
      supervisorName: editProjSupervisor || "مهندس میلاد فرخی",
      stages: flatStages.length > 0 ? flatStages : selectedProj.stages,
      stageTree,
      currentStage: editProjStage || selectedProj.currentStage,
      numberOfBlocks: editBlocksConfig.length,
      numberingStyle: editNumberingStyle,
      blocks: editBlocksConfig,
      generatedUnits: syncBlocksOnSave ? generatedUnits : undefined,
      syncBlockUnits: true,
      numberOfUnits: finalUnitCount,
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
      floor: newUnitFloor !== "" ? newUnitFloor : "0",
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
  const saveUnitDetailsCore = (closeAfterSave: boolean) => {
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
      floor: editUnitFloor.trim() !== "" ? editUnitFloor.trim() : "0",
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
    if (closeAfterSave) {
      setSelectedUnit(null);
    } else {
      setSelectedUnit(updated);
      setUnitSavedToast("مشخصات واحد، متراژ تفکیکی و وضعیت واگذاری با موفقیت ذخیره شد.");
      setTimeout(() => setUnitSavedToast(null), 3500);
    }
  };

  const handleSaveUnitFullDetails = (e: React.FormEvent) => {
    e.preventDefault();
    saveUnitDetailsCore(true);
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
          <h2 className="text-lg font-extrabold text-slate-900">مهندسی فروش، بهای تمام شده و مدیریت بلوک‌ها و واحدها</h2>
          <p className="text-slate-500 text-xs mt-1 font-light">
            امکان تعیین تعداد واحد مجزا برای هر طبقه (مثلاً همکف ۲ واحد، سایر طبقات ۴ واحد) و نام‌گذاری خودکار به فرمت <strong className="font-mono text-indigo-700">A01, A02, A11...</strong> فراهم است.
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
            <span>پروژه جدید (با بلوک‌بندی و طبقه‌بندی خودکار)</span>
          </button>
        </div>
      </div>

      {/* Add New Project Drawer with Per-Floor Block Structuring & Unit Numbering */}
      {isAddingProj && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-teal-50/40 border-2 border-teal-200 p-6 rounded-2xl space-y-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/70 pb-3">
            <h3 className="text-sm font-extrabold text-teal-950 flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-600" />
              تعریف پروژه عمرانی جدید + بلوک‌بندی، تعیین تعداد واحد هر طبقه و نام‌گذاری خودکار
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingProj(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer self-end sm:self-auto"
            >
              بستن ×
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-5 text-xs">
            {/* Row 1: General Project Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700">نام پروژه ساختمانی *</label>
                <input
                  type="text"
                  placeholder="مثال: مجتمع مسکونی افرا"
                  value={projName}
                  onChange={e => setProjName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-bold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700">آدرس کارگاه</label>
                <input
                  type="text"
                  placeholder="مثال: تهران، سعادت‌آباد"
                  value={projAddress}
                  onChange={e => setProjAddress(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700">زیربنای کل ناخالص (مترمربع)</label>
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
                <label className="block text-[10px] font-bold text-slate-700">بودجه برآوردی کل (ریال)</label>
                <FormattedAmountInput
                  value={projBudget}
                  onChange={setProjBudget}
                  placeholder="مثال: ۱۰۰,۰۰۰,۰۰۰,۰۰۰"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-700">مدیر و ناظر ارشد</label>
                <input
                  type="text"
                  placeholder="نام مهندس ناظر"
                  value={projSupervisor}
                  onChange={e => setProjSupervisor(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>
            </div>

            {/* Row 2: Automatic Block & Per-Floor Structuring Engine */}
            <div className="bg-white border border-teal-200 rounded-2xl p-4 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Grid className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-extrabold text-slate-900 text-xs">
                    تنظیمات خودکار بلوک‌ها، تعداد واحد در هر طبقه (همکف و طبقات بالا) و فرمول نام‌گذاری
                  </h4>
                </div>
                <span className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-lg font-extrabold">
                  مجموع کل واحدهای تولیدی: {toFarsiDigits(totalConfiguredUnits)} واحد در {toFarsiDigits(blocksConfig.length)} بلوک
                </span>
              </div>

              {/* Block Generator Global Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">۱. تعداد بلوک‌های پروژه</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateBlockCountOrPattern(numBlocks - 1, blockNamingPattern)}
                      className="p-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-xl font-bold cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={numBlocks}
                      onChange={e => {
                        const val = parseInt(toEnglishDigits(e.target.value).replace(/[^\d]/g, ""), 10) || 1;
                        handleUpdateBlockCountOrPattern(val, blockNamingPattern);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl py-1.5 text-center font-mono font-black text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateBlockCountOrPattern(numBlocks + 1, blockNamingPattern)}
                      className="p-2 bg-white hover:bg-teal-50 text-teal-600 border border-slate-200 rounded-xl font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">۲. الگوی نام‌گذاری خودکار بلوک‌ها</label>
                  <select
                    value={blockNamingPattern}
                    onChange={e => handleUpdateBlockCountOrPattern(numBlocks, e.target.value as BlockNamingPattern)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="english">حروف انگلیسی (بلوک A، بلوک B، بلوک C...)</option>
                    <option value="persian">حروف فارسی (بلوک الف، بلوک ب، بلوک ج...)</option>
                    <option value="numeric">عددی (بلوک ۱، بلوک ۲، بلوک ۳...)</option>
                    <option value="directional">جهت جغرافیایی (شمالی، جنوبی، شرقی، غربی)</option>
                    <option value="none">بدون پیشوند بلوک</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-indigo-800 mb-1">۳. فرمول نام‌گذاری خودکار واحدها *</label>
                  <select
                    value={numberingStyle}
                    onChange={e => setNumberingStyle(e.target.value as UnitNumberingStyle)}
                    className="w-full bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 font-bold text-indigo-950 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="block_floor_unit_short">
                      کد بلوک + طبقه + شماره واحد (همکف: A01, A02 | طبقه اول: A11 تا A14)
                    </option>
                    <option value="block_seq_padded">
                      کد بلوک + شماره دو رقمی ترتیبی (A01, A02, A03, A04...)
                    </option>
                    <option value="block_unit">
                      کد بلوک + طبقه صدگان با خط تیره (همکف: A-01 | طبقه اول: A-101, A-102)
                    </option>
                    <option value="floor_unit">
                      بدون نام بلوک - طبقه و واحد (همکف: 01, 02 | طبقه اول: 101, 102)
                    </option>
                    <option value="sequential">
                      شماره‌گذاری ترتیبی ساده (1, 2, 3...)
                    </option>
                  </select>
                </div>
              </div>

              {/* Per-Block & Per-Floor Interactive Cards */}
              <div className="space-y-4">
                {blocksConfig.map((blk, idx) => {
                  const floorConfigs =
                    Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0
                      ? blk.floorConfigs
                      : buildDefaultFloorConfigs(blk.floors ?? 4, blk.groundFloorUnits ?? 2, blk.unitsPerFloor ?? 4);
                  const blockPreviewUnits = buildGeneratedUnitsFromBlocks([blk], numberingStyle);
                  const firstU = blockPreviewUnits[0]?.unitNumber || "-";
                  const lastU = blockPreviewUnits[blockPreviewUnits.length - 1]?.unitNumber || "-";

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 space-y-3.5"
                    >
                      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-indigo-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-indigo-950">
                            بلوک شماره {toFarsiDigits(idx + 1)} {blk.name ? `(بلوک ${blk.name})` : ""}
                          </span>
                          <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-bold">
                            جمع این بلوک: {toFarsiDigits(blk.totalUnits)} واحد ({ firstU } تا { lastU })
                          </span>
                        </div>

                        {blocksConfig.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleCopyBlockFloorsToAll(idx, false)}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>اعمال چیدمان طبقات این بلوک برای سایر بلوک‌ها</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Block Settings Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">نام / کد بلوک</label>
                          <input
                            type="text"
                            placeholder="مثال: A"
                            value={blk.name}
                            onChange={e => handleUpdateBlockQuickSetting(idx, "name", e.target.value, false)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-center font-black text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-teal-800 mb-1">
                            تعداد واحد در طبقه همکف (۰)
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", Math.max(0, (blk.groundFloorUnits ?? 2) - 1), false)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.groundFloorUnits ?? 2}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", e.target.value, false)}
                              className="w-full bg-teal-50/50 border border-teal-300 rounded-lg py-1 text-center font-mono font-black text-teal-950"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", (blk.groundFloorUnits ?? 2) + 1, false)}
                              className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            تعداد طبقات بالای همکف
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "floors", Math.max(0, (blk.floors ?? 4) - 1), false)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.floors ?? 4}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "floors", e.target.value, false)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 text-center font-mono font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "floors", (blk.floors ?? 4) + 1, false)}
                              className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 mb-1">
                            واحد پیش‌فرض در سایر طبقات
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", Math.max(1, (blk.unitsPerFloor ?? 4) - 1), false)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.unitsPerFloor ?? 4}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", e.target.value, false)}
                              className="w-full bg-indigo-50/50 border border-indigo-300 rounded-lg py-1 text-center font-mono font-black text-indigo-950"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", (blk.unitsPerFloor ?? 4) + 1, false)}
                              className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Per-Floor Individual Customization Grid */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-600 font-bold">
                          <span>تنظیم اختصاصی تعداد واحد به تفکیک تک‌تک طبقات این بلوک (در صورت تفاوت هر طبقه می‌توانید عدد آن طبقه را تغییر دهید):</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                          {floorConfigs.map(fc => {
                            const isGround = fc.floorNumber === 0;
                            // Compute unit numbers for this specific floor to show in preview
                            const sampleStart = fc.unitsCount > 0
                              ? formatUnitCode(blk.name, fc.floorNumber, 1, 1, 1, blocksConfig.length, numberingStyle)
                              : "-";
                            const sampleEnd = fc.unitsCount > 1
                              ? formatUnitCode(blk.name, fc.floorNumber, fc.unitsCount, fc.unitsCount, fc.unitsCount, blocksConfig.length, numberingStyle)
                              : sampleStart;

                            return (
                              <div
                                key={fc.floorNumber}
                                className={`p-2.5 rounded-xl border space-y-1.5 ${
                                  isGround
                                    ? "bg-teal-50/70 border-teal-300"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className={`text-[10px] font-extrabold ${isGround ? "text-teal-900" : "text-slate-800"}`}>
                                    {isGround ? "طبقه همکف (۰)" : `طبقه ${toFarsiDigits(fc.floorNumber)}`}
                                  </span>
                                  <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {fc.unitsCount === 0
                                      ? "بدون واحد"
                                      : fc.unitsCount === 1
                                      ? sampleStart
                                      : `${sampleStart}..${sampleEnd}`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateFloorUnitCount(idx, fc.floorNumber, fc.unitsCount - 1, false)}
                                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={fc.unitsCount}
                                    onChange={e => {
                                      const val = parseInt(toEnglishDigits(e.target.value).replace(/[^\d]/g, ""), 10) || 0;
                                      handleUpdateFloorUnitCount(idx, fc.floorNumber, val, false);
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded py-0.5 text-center font-mono font-black text-slate-900 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateFloorUnitCount(idx, fc.floorNumber, fc.unitsCount + 1, false)}
                                    className="p-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded border border-teal-200 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Preview of Generated Units */}
              {previewGeneratedUnits.length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="text-[10px] font-extrabold text-slate-700">
                    پیش‌نمایش زنده واحدهای تولیدی و نام‌گذاری خودکار ({toFarsiDigits(previewGeneratedUnits.length)} واحد):
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {previewGeneratedUnits.slice(0, 60).map((u, i) => (
                      <span
                        key={i}
                        className={`px-2 py-1 border rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                          u.floor === "0"
                            ? "bg-teal-50 border-teal-200 text-teal-900"
                            : "bg-white border-slate-200 text-slate-800"
                        }`}
                      >
                        <strong className="font-mono text-indigo-700">{u.unitNumber}</strong>
                        <span className="text-[9px] text-slate-500">
                          ({u.blockName ? `بلوک ${u.blockName}، ` : ""}
                          {u.floor === "0" ? "همکف" : `طبقه ${toFarsiDigits(u.floor)}`})
                        </span>
                      </span>
                    ))}
                    {previewGeneratedUnits.length > 60 && (
                      <span className="text-[10px] text-slate-400 font-bold self-center">
                        و {toFarsiDigits(previewGeneratedUnits.length - 60)} واحد دیگر...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl px-6 py-2.5 transition-all cursor-pointer shadow-sm"
              >
                ثبت پروژه و ساخت خودکار {toFarsiDigits(totalConfiguredUnits)} واحد با نام‌گذاری انتخاب‌شده
              </button>
              <button
                type="button"
                onClick={() => setIsAddingProj(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl px-5 py-2.5 transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Edit Active Project Drawer */}
      {isEditingProj && selectedProj && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-amber-600" />
              ویرایش اطلاعات کلی، بلوک‌بندی و چیدمان طبقات پروژه «{selectedProj.name}»
            </h3>
            <button onClick={() => setIsEditingProj(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">
              بستن ×
            </button>
          </div>
          <form onSubmit={handleSaveEditProj} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </div>

            {/* Edit Blocks & Per-Floor Section */}
            <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <span className="font-extrabold text-amber-950 text-xs block">
                    ساختار بلوک‌ها و تعداد واحد هر طبقه (همگام‌سازی خودکار کم و زیاد شدن واحدها):
                  </span>
                  <span className="text-[10px] text-slate-600">
                    تعداد واحد فعلی پروژه: <strong className="font-mono text-slate-900">{toFarsiDigits(projUnits.length)}</strong> واحد
                    {" ⬅ "}
                    تعداد واحد پس از ذخیره تغییرات: <strong className="font-mono text-indigo-700">{toFarsiDigits(editTotalConfiguredUnits)}</strong> واحد
                    {editTotalConfiguredUnits > projUnits.length && (
                      <span className="text-emerald-700 font-bold mr-1">
                        (+{toFarsiDigits(editTotalConfiguredUnits - projUnits.length)} واحد جدید ساخته می‌شود)
                      </span>
                    )}
                    {editTotalConfiguredUnits < projUnits.length && (
                      <span className="text-rose-700 font-bold mr-1">
                        ({toFarsiDigits(projUnits.length - editTotalConfiguredUnits)} واحد آزاد مازاد به صورت خودکار حذف می‌شود)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={editNumberingStyle}
                    onChange={e => {
                      setEditNumberingStyle(e.target.value as UnitNumberingStyle);
                      setSyncBlocksOnSave(true);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-indigo-900"
                  >
                    <option value="block_floor_unit_short">نام‌گذاری: A01 (همکف)، A11 (طبقه ۱)...</option>
                    <option value="block_seq_padded">نام‌گذاری: A01, A02, A03...</option>
                    <option value="block_unit">نام‌گذاری: A-01, A-101...</option>
                    <option value="floor_unit">نام‌گذاری: 01, 101...</option>
                    <option value="sequential">شماره‌گذاری ترتیبی: 1, 2, 3...</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = editBlocksConfig.length;
                      setEditBlocksConfig([
                        ...editBlocksConfig,
                        createInitialBlockConfig(getAutoBlockName(nextIdx, "english", nextIdx + 1))
                      ]);
                      setSyncBlocksOnSave(true);
                    }}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    + افزودن بلوک جدید
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {editBlocksConfig.map((blk, idx) => {
                  const floorConfigs =
                    Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0
                      ? blk.floorConfigs
                      : buildDefaultFloorConfigs(blk.floors ?? 4, blk.groundFloorUnits ?? 2, blk.unitsPerFloor ?? 4);

                  return (
                    <div key={idx} className="p-3 bg-amber-50/40 border border-amber-200/80 rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 text-[11px]">
                          بلوک {toFarsiDigits(idx + 1)} {blk.name ? `(${blk.name})` : ""} — جمع این بلوک: {toFarsiDigits(blk.totalUnits)} واحد
                        </span>
                        <div className="flex items-center gap-2">
                          {editBlocksConfig.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleCopyBlockFloorsToAll(idx, true)}
                              className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              کپی برای سایر بلوک‌ها
                            </button>
                          )}
                          {editBlocksConfig.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditBlocksConfig(editBlocksConfig.filter((_, i) => i !== idx));
                                setSyncBlocksOnSave(true);
                              }}
                              className="text-rose-500 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
                            >
                              حذف بلوک
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-500 block mb-0.5">نام بلوک</label>
                          <input
                            type="text"
                            value={blk.name}
                            onChange={e => handleUpdateBlockQuickSetting(idx, "name", e.target.value, true)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-teal-800 font-bold block mb-0.5">واحد در همکف (۰)</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", Math.max(0, (blk.groundFloorUnits ?? 2) - 1), true)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.groundFloorUnits ?? 2}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", e.target.value, true)}
                              className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1 text-center font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "groundFloorUnits", (blk.groundFloorUnits ?? 2) + 1, true)}
                              className="p-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 block mb-0.5">طبقات بالای همکف</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "floors", Math.max(0, (blk.floors ?? 4) - 1), true)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.floors}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "floors", e.target.value, true)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "floors", (blk.floors ?? 4) + 1, true)}
                              className="p-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] text-indigo-800 font-bold block mb-0.5">واحد در سایر طبقات</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", Math.max(1, (blk.unitsPerFloor ?? 4) - 1), true)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={blk.unitsPerFloor}
                              onChange={e => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", e.target.value, true)}
                              className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-center font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockQuickSetting(idx, "unitsPerFloor", (blk.unitsPerFloor ?? 4) + 1, true)}
                              className="p-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded border border-teal-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 pt-1">
                        {floorConfigs.map(fc => (
                          <div key={fc.floorNumber} className="bg-white p-1.5 rounded-lg border border-slate-200 flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold text-slate-600">
                              {fc.floorNumber === 0 ? "همکف:" : `ط${toFarsiDigits(fc.floorNumber)}:`}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateFloorUnitCount(idx, fc.floorNumber, fc.unitsCount - 1, true)}
                                className="px-1 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={fc.unitsCount}
                                onChange={e => {
                                  const val = parseInt(toEnglishDigits(e.target.value).replace(/[^\d]/g, ""), 10) || 0;
                                  handleUpdateFloorUnitCount(idx, fc.floorNumber, val, true);
                                }}
                                className="w-8 bg-slate-50 border border-slate-200 rounded text-center font-mono font-bold text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFloorUnitCount(idx, fc.floorNumber, fc.unitsCount + 1, true)}
                                className="px-1 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-[10px] font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {editPreviewGeneratedUnits.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="text-[10px] font-extrabold text-slate-700">
                    پیش‌نمایش زنده واحدهای پروژه پس از ویرایش ({toFarsiDigits(editPreviewGeneratedUnits.length)} واحد):
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {editPreviewGeneratedUnits.map((u, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-indigo-800"
                      >
                        {u.unitNumber}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-6 py-2.5 transition-all cursor-pointer shadow-sm">
                ذخیره تغییرات پروژه و به‌روزرسانی خودکار واحدها ({toFarsiDigits(editTotalConfiguredUnits)} واحد)
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
                  <span className="font-bold text-indigo-700 font-mono">
                    {toFarsiDigits(projUnits.length)} واحد
                    {uniqueBlockNames.length > 0 ? ` (${toFarsiDigits(uniqueBlockNames.length)} بلوک)` : ""}
                  </span>
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

              {/* Hierarchical & Editable Construction Stages Tree (Requirement 7) */}
              <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-teal-600" />
                    درخت شاخه‌بندی مراحل ساخت پروژه ({toFarsiDigits(stageTree.length)} شاخه اصلی)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsStageManagerOpen(!isStageManagerOpen)}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    {isStageManagerOpen ? "بستن ویرایشگر مراحل" : "ویرایش و افزودن شاخه‌ها"}
                  </button>
                </div>

                <div className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-2.5 py-1.5 font-bold flex items-center justify-between">
                  <span>مرحله جاری پروژه:</span>
                  <span className="font-extrabold text-teal-950">{selectedProj.currentStage}</span>
                </div>

                {/* Add Main Branch Input when Stage Manager is Open */}
                {isStageManagerOpen && (
                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="نام شاخه اصلی جدید (مثال: ۱۱. محوطه‌سازی و فضای سبز)..."
                        value={newBranchName}
                        onChange={e => setNewBranchName(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-none focus:border-teal-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddMainStageBranch}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        + شاخه اصلی
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>برای تغییر وضعیت هر زیرشاخه روی دایره وضعیت آن کلیک کنید.</span>
                      <button
                        type="button"
                        onClick={() => persistStageTreeChanges(DEFAULT_PROJECT_STAGE_TREE)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        بازنشانی به ساختار استاندارد ۱۰ شاخه‌ای
                      </button>
                    </div>
                  </div>
                )}

                {/* Tree Branches List */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                  {stageTree.map((branch) => {
                    const isExpanded = !!expandedStageBranches[branch.id];
                    const completedCount = (branch.subStages || []).filter(s => s.status === "completed").length;
                    const totalSubs = (branch.subStages || []).length;

                    return (
                      <div key={branch.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                          {editingBranchId === branch.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="text"
                                value={editingBranchTitle}
                                onChange={e => setEditingBranchTitle(e.target.value)}
                                className="flex-1 bg-white border border-teal-400 rounded-lg px-2 py-1 text-[11px] font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveBranchTitle(branch.id)}
                                className="px-2 py-1 bg-teal-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                ذخیره
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBranchId(null)}
                                className="px-1.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                setExpandedStageBranches(prev => ({
                                  ...prev,
                                  [branch.id]: !prev[branch.id]
                                }))
                              }
                              className="flex items-center gap-1.5 flex-1 cursor-pointer select-none"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              ) : (
                                <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="text-[11px] font-extrabold text-slate-800 leading-snug">
                                {branch.name}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                              {toFarsiDigits(completedCount)}/{toFarsiDigits(totalSubs)}
                            </span>
                            {isStageManagerOpen && editingBranchId !== branch.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBranchId(branch.id);
                                    setEditingBranchTitle(branch.name);
                                  }}
                                  className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                                  title="ویرایش نام شاخه اصلی"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMainStageBranch(branch.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="حذف شاخه اصلی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-2.5 space-y-1.5 bg-white">
                            {(branch.subStages || []).map((sub) => {
                              const isCurrent = selectedProj.currentStage === sub.name;
                              return (
                                <div
                                  key={sub.id}
                                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] ${
                                    isCurrent
                                      ? "bg-amber-50/80 border-amber-300 text-amber-950 font-bold"
                                      : sub.status === "completed"
                                      ? "bg-emerald-50/40 border-emerald-100 text-emerald-900"
                                      : "bg-slate-50/50 border-slate-100 text-slate-700"
                                  }`}
                                >
                                  {editingSubStageId === sub.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                      <input
                                        type="text"
                                        value={editingSubStageTitle}
                                        onChange={e => setEditingSubStageTitle(e.target.value)}
                                        className="flex-1 bg-white border border-teal-400 rounded px-2 py-0.5 text-[11px]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveSubStageTitle(branch.id, sub.id)}
                                        className="px-2 py-0.5 bg-teal-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        ثبت
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingSubStageId(null)}
                                        className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => handleCycleSubStageStatus(branch.id, sub.id)}
                                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center cursor-pointer shrink-0 ${
                                            sub.status === "completed"
                                              ? "bg-emerald-500 border-emerald-600 text-white"
                                              : sub.status === "in_progress" || isCurrent
                                              ? "bg-amber-400 border-amber-500 text-white"
                                              : "bg-white border-slate-300"
                                          }`}
                                          title="کلیک جهت تغییر وضعیت (در انتظار / در حال اجرا / تکمیل شده)"
                                        >
                                          {sub.status === "completed" && "✓"}
                                        </button>
                                        <span
                                          onClick={() => persistStageTreeChanges(stageTree, sub.name)}
                                          className="cursor-pointer hover:text-teal-700 flex-1 leading-relaxed"
                                          title="کلیک جهت انتخاب به عنوان مرحله جاری پروژه"
                                        >
                                          {sub.name}
                                          {isCurrent && (
                                            <span className="mr-1.5 text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                                              گام فعلی
                                            </span>
                                          )}
                                        </span>
                                      </div>

                                      {isStageManagerOpen && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingSubStageId(sub.id);
                                              setEditingSubStageTitle(sub.name);
                                            }}
                                            className="p-0.5 text-slate-400 hover:text-amber-600 cursor-pointer"
                                            title="ویرایش عنوان زیرشاخه"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSubStageItem(branch.id, sub.id)}
                                            className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                            title="حذف زیرشاخه"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add new sub-stage input inside branch */}
                            <div className="flex items-center gap-1 pt-1">
                              <input
                                type="text"
                                placeholder={`+ افزودن زیرشاخه جدید در «${branch.name.slice(0, 22)}...»`}
                                value={newSubStageInputs[branch.id] || ""}
                                onChange={e =>
                                  setNewSubStageInputs(prev => ({ ...prev, [branch.id]: e.target.value }))
                                }
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddSubStageItem(branch.id);
                                  }
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] focus:outline-none focus:border-teal-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSubStageItem(branch.id)}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
                              >
                                + افزودن زیرشاخه
                              </button>
                            </div>
                          </div>
                        )}
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
                                <span className="font-bold text-slate-700">واحد {u.unitNumber}</span>
                                <span className="text-[10px] text-slate-400 mr-1.5">
                                  ({u.floor === "0" ? "همکف" : `طبقه ${toFarsiDigits(u.floor)}`})
                                </span>
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

          {/* Bento Box 2 & 3: Units Grid by Block */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    🏢 لیست واحدهای پروژه به تفکیک بلوک و طبقه (کلیک روی هر واحد ⬅ باز شدن پنجره پاپ‌آپ ویرایش)
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintUnits("after_filter")}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 flex items-center gap-1 cursor-pointer"
                    title="چاپ واحدهای فیلتر شده فعلی"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ نتایج فیلتر شده ({toFarsiDigits(filteredProjUnits.length)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintUnits("before_filter")}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 flex items-center gap-1 cursor-pointer"
                    title="چاپ کل واحدهای پروژه بدون فیلتر"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ کل واحدها (قبل از فیلتر: {toFarsiDigits(projUnits.length)})</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingSingleUnit(true);
                      setIsAddingProj(false);
                      setIsEditingProj(false);
                    }}
                    className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[10px] font-bold border border-teal-200 transition-colors cursor-pointer"
                  >
                    ➕ افزودن تک واحد جدید
                  </button>
                </div>
              </div>

              {/* Search & Advanced Search Bar for Units (Requirement 2) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={unitSearchQuery}
                      onChange={e => setUnitSearchQuery(e.target.value)}
                      placeholder="جستجوی سریع شماره واحد (مثلاً A01)، نام خریدار، بلوک یا طبقه..."
                      className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedUnitSearch(!showAdvancedUnitSearch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                      showAdvancedUnitSearch
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>جستجوی پیشرفته واحدها</span>
                  </button>
                  {(unitSearchQuery || unitStatusFilter !== "ALL" || unitFloorFilter !== "ALL" || unitMinArea || unitMaxArea || unitMinPrice || unitMaxPrice || activeBlockFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnitSearchQuery("");
                        setUnitStatusFilter("ALL");
                        setUnitFloorFilter("ALL");
                        setUnitMinArea("");
                        setUnitMaxArea("");
                        setUnitMinPrice("");
                        setUnitMaxPrice("");
                        setActiveBlockFilter("ALL");
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold cursor-pointer"
                    >
                      پاکسازی فیلترها
                    </button>
                  )}
                </div>

                {showAdvancedUnitSearch && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">وضعیت واگذاری</label>
                      <select
                        value={unitStatusFilter}
                        onChange={e => setUnitStatusFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                      >
                        <option value="ALL">همه وضعیت‌ها</option>
                        <option value="available">آزاد / آماده واگذاری</option>
                        <option value="pre_sold">پیش‌فروش شده</option>
                        <option value="sold">فروخته شده</option>
                        <option value="bartered">تهاتر شده</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">طبقه</label>
                      <select
                        value={unitFloorFilter}
                        onChange={e => setUnitFloorFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                      >
                        <option value="ALL">همه طبقات</option>
                        {uniqueFloors.map(fl => (
                          <option key={fl} value={fl}>
                            {fl === "0" ? "طبقه همکف (۰)" : `طبقه ${toFarsiDigits(fl)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">حداقل متراژ (متر)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={unitMinArea}
                        onChange={e => setUnitMinArea(toEnglishDigits(e.target.value))}
                        placeholder="مثلاً 80"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">حداکثر متراژ (متر)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={unitMaxArea}
                        onChange={e => setUnitMaxArea(toEnglishDigits(e.target.value))}
                        placeholder="مثلاً 200"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">حداقل قیمت کل (ریال)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={unitMinPrice}
                        onChange={e => setUnitMinPrice(toEnglishDigits(e.target.value))}
                        placeholder="حداقل بهای کل"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">حداکثر قیمت کل (ریال)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={unitMaxPrice}
                        onChange={e => setUnitMaxPrice(toEnglishDigits(e.target.value))}
                        placeholder="حداکثر بهای کل"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Block Filter Tabs */}
              {uniqueBlockNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-150">
                  <span className="text-[10px] font-bold text-slate-500 ml-1">فیلتر بلوک‌ها:</span>
                  <button
                    type="button"
                    onClick={() => setActiveBlockFilter("ALL")}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      activeBlockFilter === "ALL"
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    همه واحدها ({toFarsiDigits(projUnits.length)})
                  </button>
                  {uniqueBlockNames.map(bName => {
                    const count = projUnits.filter(u => (u.blockName || "").trim() === bName).length;
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => setActiveBlockFilter(bName)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          activeBlockFilter === bName
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                        }`}
                      >
                        بلوک {bName} ({toFarsiDigits(count)} واحد)
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredProjUnits.length === 0 ? (
                  <div className="col-span-full text-center py-8 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs font-light">
                    هیچ واحدی یافت نشد. می‌توانید از طریق «ویرایش پروژه» بلوک‌بندی خودکار را فعال کنید یا «افزودن تک واحد» را بزنید.
                  </div>
                ) : (
                  filteredProjUnits.map(unit => {
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
                              <span className="text-xs font-black text-slate-900 font-mono">
                                واحد {unit.unitNumber}
                              </span>
                              {unit.blockName && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                                  بلوک {unit.blockName}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-1">
                              {unit.floor === "0" ? "طبقه همکف (۰)" : `طبقه ${toFarsiDigits(unit.floor)}`} |{" "}
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
                            بدون اختصاص (آزاد)
                          </div>
                        )}

                        <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">
                            {unit.saleAreaType === "with_commons" ? "با مشاعات" : "فروش مفید"}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedUnit(unit);
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ویرایش واحد</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 1: Add Single Unit Modal */}
      <AnimatePresence>
        {isAddingSingleUnit && selectedProj && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddingSingleUnit(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-2xl border border-teal-200 shadow-2xl p-6 space-y-4 my-8"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-teal-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-teal-600" />
                  افزودن تک واحد جدید به پروژه «{selectedProj.name}»
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingSingleUnit(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSingleUnit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">شماره واحد *</label>
                  <input
                    type="text"
                    placeholder="مثال: A01 یا A11"
                    value={newUnitNum}
                    onChange={e => setNewUnitNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">نام بلوک (اختیاری)</label>
                  <input
                    type="text"
                    placeholder="مثال: A"
                    value={newUnitBlock}
                    onChange={e => setNewUnitBlock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">طبقه (۰ = همکف)</label>
                  <input
                    type="text"
                    placeholder="مثال: ۰ برای همکف یا ۱ برای طبقه اول"
                    value={newUnitFloor}
                    onChange={e => setNewUnitFloor(toEnglishDigits(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">نوع محاسبه متراژ فروش</label>
                  <select
                    value={newUnitSaleAreaType}
                    onChange={e => setNewUnitSaleAreaType(e.target.value as "useful" | "with_commons")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold text-slate-800"
                  >
                    <option value="useful">فروش واحد مفید (بدون مشاعات)</option>
                    <option value="with_commons">فروش واحد با مشاعات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">متراژ مفید (مترمربع)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="مثال: ۱۱۰"
                    value={newUnitUsefulArea}
                    onChange={e => setNewUnitUsefulArea(toEnglishDigits(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">متراژ انباری (مترمربع)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="۰"
                    value={newUnitStorageArea}
                    onChange={e => setNewUnitStorageArea(toEnglishDigits(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">متراژ پارکینگ (مترمربع)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="۰"
                    value={newUnitParkingArea}
                    onChange={e => setNewUnitParkingArea(toEnglishDigits(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
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
                        : "bg-slate-50 border-slate-200 focus:outline-none focus:border-teal-500"
                    }`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">قیمت پایه هر متر مربع (ریال)</label>
                  <FormattedAmountInput
                    value={newUnitPricePerMeter}
                    onChange={setNewUnitPricePerMeter}
                    placeholder="مثال: ۵۰,۰۰۰,۰۰۰ (یا در قرارداد تعیین شود)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl px-6 py-2.5 transition-all cursor-pointer">
                    ثبت و افزودن واحد
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSingleUnit(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL 2: Unit Inspector & Full Editor Modal */}
      <AnimatePresence>
        {selectedUnit && (() => {
          const alloc = getUnitAllocationInfo(selectedUnit);
          const computedPreviewTotalPrice = Math.round(
            (parseFloat(toEnglishDigits(editUnitArea)) || 0) *
            (Number(toEnglishDigits(editUnitPricePerMeter)) || 0)
          );

          return (
            <motion.div
              key="unit-edit-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUnit(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={e => e.stopPropagation()}
                className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-teal-500/50 shadow-2xl p-5 sm:p-6 space-y-5 my-auto"
              >
                {/* Sticky Top Header inside Popup Modal */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-150 pb-4 sticky top-0 bg-white z-10">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-teal-500 animate-pulse" />
                    <h4 className="font-black text-slate-900 text-sm sm:text-base">
                      پنجره ویرایش و شناسنامه واحد {selectedUnit.unitNumber}
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
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-bold cursor-pointer"
                          >
                            انصراف
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>بستن</span>
                    </button>
                  </div>
                </div>

                {unitSavedToast && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{unitSavedToast}</span>
                  </div>
                )}

                {/* Allocation Status Banner */}
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
                <form onSubmit={handleSaveUnitFullDetails} className="space-y-5 text-xs">
                  {/* Section 1: Basic Physical & Block Info + Sale Area Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">شماره واحد *</label>
                      <input
                        type="text"
                        value={editUnitNumber}
                        onChange={e => setEditUnitNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">نام بلوک</label>
                      <input
                        type="text"
                        placeholder="مثال: A"
                        value={editUnitBlock}
                        onChange={e => setEditUnitBlock(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">طبقه (۰ = همکف)</label>
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

                      {/* Common Area */}
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

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-black transition-all cursor-pointer text-xs shadow-md"
                    >
                      ذخیره تغییرات و بستن پنجره
                    </button>
                    <button
                      type="button"
                      onClick={() => saveUnitDetailsCore(false)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all cursor-pointer text-xs"
                    >
                      ذخیره بدون بستن
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(null)}
                      className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
                    >
                      انصراف
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
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

export default ProjectsManager;
