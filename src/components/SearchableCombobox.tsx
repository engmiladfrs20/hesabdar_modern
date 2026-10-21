import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search, Check } from "lucide-react";

export interface ComboboxOption {
  id?: string;
  value?: string;
  label: string;
  subLabel?: string;
  group?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onCustomAdd?: (searchQuery: string) => void;
  onCustomClick?: (searchQuery: string) => void;
  customAddLabel?: string;
  allowCustom?: boolean;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function getOptionKey(opt: ComboboxOption): string {
  return opt.id !== undefined ? opt.id : (opt.value !== undefined ? opt.value : opt.label);
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "انتخاب یا جستجو کنید...",
  label,
  onCustomAdd,
  onCustomClick,
  customAddLabel = "افزودن مورد جدید",
  allowCustom = false,
  emptyMessage = "موردی یافت نشد.",
  required = false,
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const customAction = onCustomAdd || onCustomClick;

  const selectedOption = options.find((o) => getOptionKey(o) === value);
  const displayLabel = selectedOption ? selectedOption.label : (value || "");

  // Sync display text when external value changes and user is not actively typing
  useEffect(() => {
    if (!isTyping) {
      const matched = options.find((o) => getOptionKey(o) === value);
      setSearch(matched ? matched.label : (value || ""));
    }
  }, [value, isTyping, options.length]);

  // Filter options based on search string ONLY when user is actively typing a filter
  const activeQuery = isTyping ? search.trim().toLowerCase() : "";
  const filteredOptions = options.filter((o) => {
    if (!activeQuery) return true;
    const matchLabel = (o.label || "").toLowerCase().includes(activeQuery);
    const matchSub = o.subLabel ? o.subLabel.toLowerCase().includes(activeQuery) : false;
    const matchGroup = o.group ? o.group.toLowerCase().includes(activeQuery) : false;
    return matchLabel || matchSub || matchGroup;
  });

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const isIdMapped = options.some(
    (o) => o.value && o.value !== o.label && /^(p|c|u|a|m|t|ps|imp)_/.test(String(o.value))
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          setIsTyping(false);
          // If user typed something while open
          if (search.trim()) {
            const exactMatch = options.find(
              (o) => o.label.trim() === search.trim() || getOptionKey(o) === search.trim()
            );
            if (exactMatch) {
              onChange(getOptionKey(exactMatch));
              setSearch(exactMatch.label);
            } else if (allowCustom && !isIdMapped) {
              onChange(search.trim());
            } else {
              const currentMatch = options.find((o) => getOptionKey(o) === value);
              setSearch(currentMatch ? currentMatch.label : (value || ""));
            }
          } else {
            const currentMatch = options.find((o) => getOptionKey(o) === value);
            setSearch(currentMatch ? currentMatch.label : (value || ""));
          }
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, search, value, options, allowCustom, isIdMapped, onChange]);

  const handleSelect = (opt: ComboboxOption) => {
    const key = getOptionKey(opt);
    onChange(key);
    setSearch(opt.label);
    setIsTyping(false);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (allowCustom && !isIdMapped && search.trim()) {
        onChange(search.trim());
        setIsTyping(false);
        setIsOpen(false);
      } else if (customAction) {
        setIsTyping(false);
        setIsOpen(false);
        customAction(search.trim());
      }
    } else if (e.key === "Escape") {
      setIsTyping(false);
      setIsOpen(false);
      setSearch(displayLabel);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-slate-600 font-semibold mb-1.5 text-xs">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div
        className={`flex items-center justify-between w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
          disabled
            ? "opacity-60 cursor-not-allowed border-slate-200 bg-slate-100"
            : isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-white"
            : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={() => {
          if (disabled) return;
          if (!isOpen) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isOpen ? (
            <Search className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          ) : null}
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className="w-full bg-transparent outline-none text-xs text-slate-800 placeholder-slate-400 truncate"
            placeholder={selectedOption ? selectedOption.label : placeholder}
            value={isOpen && isTyping ? search : displayLabel}
            onChange={(e) => {
              const val = e.target.value;
              setIsTyping(true);
              setSearch(val);
              if (!isOpen) setIsOpen(true);
              const exactMatch = options.find(
                (o) => o.label.trim() === val.trim() || getOptionKey(o) === val.trim()
              );
              if (exactMatch) {
                onChange(getOptionKey(exactMatch));
              } else if (allowCustom && !isIdMapped) {
                onChange(val);
              }
            }}
            onFocus={(e) => {
              if (!disabled) {
                if (!isOpen) {
                  setIsOpen(true);
                  const target = e.currentTarget;
                  setTimeout(() => {
                    try {
                      target.select();
                    } catch {}
                  }, 0);
                }
              }
            }}
            onKeyDown={handleKeyDown}
            required={required && !value && !(isTyping && search.trim())}
          />
        </div>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            if (isOpen) {
              setIsOpen(false);
              setIsTyping(false);
            } else {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className="text-slate-400 hover:text-slate-600 p-0.5 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const optKey = getOptionKey(opt);
                const isSelected = optKey === value;
                const isHighlighted = idx === highlightedIndex;
                const prevGroup = idx > 0 ? filteredOptions[idx - 1].group : null;
                const showGroupHeader = opt.group && opt.group !== prevGroup;

                return (
                  <React.Fragment key={`${optKey}_${idx}`}>
                    {showGroupHeader && (
                      <div className="px-3 py-1 bg-slate-100/80 text-[10px] font-bold text-slate-500 sticky top-0">
                        {opt.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isHighlighted ? "bg-indigo-50/80 text-indigo-900" : "text-slate-700 hover:bg-slate-50"
                      } ${isSelected ? "font-bold bg-indigo-50/40 text-indigo-600" : ""}`}
                    >
                      <div className="truncate pr-1">
                        <div>{opt.label}</div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  </React.Fragment>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-slate-400 text-xs">
                {emptyMessage}
              </div>
            )}
          </div>

          {customAction && (
            <div className="p-1.5 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const currentTerm = isTyping ? search.trim() : "";
                  setIsTyping(false);
                  setIsOpen(false);
                  customAction(currentTerm);
                }}
                className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{customAddLabel}</span>
                {isTyping && search.trim() && (
                  <span className="font-normal text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800 truncate max-w-[120px]">
                    "{search.trim()}"
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableCombobox;
