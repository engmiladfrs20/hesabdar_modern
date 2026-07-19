import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, Check, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
  subLabel?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  allowCustom?: boolean;
  onCustomAdd?: (newValue: string) => Promise<boolean | void> | boolean | void;
  onCustomClick?: (searchTerm: string) => void;
  customAddLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "انتخاب کنید...",
  emptyMessage = "موردی یافت نشد.",
  allowCustom = false,
  onCustomAdd,
  onCustomClick,
  customAddLabel = "افزودن به عنوان مورد جدید",
  disabled = false,
  className = "",
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Normalize text for intelligent Persian search
  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ة/g, "ه")
      .replace(/[\u200C\u200B]/g, " ") // Zero-width spaces
      .trim();
  };

  // Filter options based on normalized search query
  const normalizedSearch = normalizeText(search);
  const filteredOptions = options.filter((opt) => {
    if (!normalizedSearch) return true;
    const normLabel = normalizeText(opt.label);
    const normGroup = normalizeText(opt.group || "");
    const normSub = normalizeText(opt.subLabel || "");
    return (
      normLabel.includes(normalizedSearch) ||
      normGroup.includes(normalizedSearch) ||
      normSub.includes(normalizedSearch)
    );
  });

  // Handle click outside to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update search input when selected option changes or when dropdown is toggled
  useEffect(() => {
    if (isOpen) {
      setSearch("");
    } else {
      setSearch(selectedOption ? selectedOption.label : "");
    }
  }, [isOpen, selectedOption]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleAddCustom = async () => {
    if (!search.trim()) return;
    if (onCustomClick) {
      onCustomClick(search.trim());
      setIsOpen(false);
      return;
    }
    if (!onCustomAdd) return;
    setIsAdding(true);
    try {
      const res = await onCustomAdd(search.trim());
      // If the callback returns false, we might not want to close or select, but usually we do
      if (res !== false) {
        onChange(search.trim());
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Error adding custom item to combobox:", err);
    } finally {
      setIsAdding(false);
    }
  };

  // Group filtered options if any option has a group
  const hasGroups = options.some((opt) => opt.group);
  const groupedOptions: Record<string, ComboboxOption[]> = {};
  const noGroupOptions: ComboboxOption[] = [];

  if (hasGroups) {
    filteredOptions.forEach((opt) => {
      if (opt.group) {
        if (!groupedOptions[opt.group]) {
          groupedOptions[opt.group] = [];
        }
        groupedOptions[opt.group].push(opt);
      } else {
        noGroupOptions.push(opt);
      }
    });
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-right ${className} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      dir="rtl"
    >
      {/* Input / Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all cursor-pointer"
      >
        <input
          type="text"
          className="w-full bg-transparent border-none outline-none text-slate-800 text-xs font-medium cursor-text"
          placeholder={placeholder}
          value={isOpen ? search : selectedOption ? selectedOption.label : ""}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearch(e.target.value);
          }}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen) setIsOpen(true);
          }}
        />
        <div className="flex items-center gap-1.5 text-slate-400 mr-2">
          {isOpen ? (
            <Search className="w-3.5 h-3.5 text-indigo-500" />
          ) : (
            <ChevronDown className="w-4 h-4 transition-transform duration-200" />
          )}
        </div>
      </div>

      {/* Dropdown Options Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {/* List options */}
            <div className="py-1 text-xs">
              {filteredOptions.length === 0 && !allowCustom && (
                <div className="px-4 py-3 text-slate-400 font-light text-center">{emptyMessage}</div>
              )}

              {/* Render ungrouped options */}
              {!hasGroups &&
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`flex items-center justify-between w-full px-4 py-2 text-right transition-colors hover:bg-slate-50 cursor-pointer ${
                      value === opt.value ? "bg-indigo-50/70 text-indigo-700 font-semibold" : "text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{opt.label}</span>
                      {opt.subLabel && <span className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</span>}
                    </div>
                    {value === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                ))}

              {/* Render grouped options */}
              {hasGroups && (
                <>
                  {noGroupOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`flex items-center justify-between w-full px-4 py-2 text-right transition-colors hover:bg-slate-50 cursor-pointer ${
                        value === opt.value ? "bg-indigo-50/70 text-indigo-700 font-semibold" : "text-slate-700"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs">{opt.label}</span>
                        {opt.subLabel && <span className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</span>}
                      </div>
                      {value === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  ))}

                  {Object.entries(groupedOptions).map(([group, groupOpts]) => (
                    <div key={group} className="border-b last:border-b-0 border-slate-50">
                      <div className="px-3.5 py-1.5 bg-slate-50/80 text-[10px] font-extrabold text-slate-500 tracking-wider">
                        {group}
                      </div>
                      {groupOpts.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={`flex items-center justify-between w-full px-4 py-2 text-right transition-colors hover:bg-slate-50 cursor-pointer ${
                            value === opt.value ? "bg-indigo-50/70 text-indigo-700 font-semibold" : "text-slate-700"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs">{opt.label}</span>
                            {opt.subLabel && <span className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</span>}
                          </div>
                          {value === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {/* Add Custom Option Row */}
              {allowCustom && search.trim() !== "" && !options.some((opt) => opt.label.trim() === search.trim()) && (
                <div className="border-t border-slate-100 mt-1 p-1">
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={isAdding}
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-all text-xs cursor-pointer"
                  >
                    {isAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {customAddLabel}: <strong className="underline">"{search.trim()}"</strong>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
