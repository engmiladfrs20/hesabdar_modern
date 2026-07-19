import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// --- Jalali / Gregorian Conversion Helpers ---
function isLeapJalali(jy: number): boolean {
  const r = (jy - 474) % 2820;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes((r % 128) % 33);
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jalaliEpoch = jy - 979;
  let jyDays = 365 * jalaliEpoch + Math.floor(jalaliEpoch / 33) * 8 + Math.floor(((jalaliEpoch % 33) + 3) / 4);
  for (let i = 0; i < jm - 1; ++i) {
    jyDays += i < 6 ? 31 : 30;
  }
  jyDays += jd - 1;
  let gDays = jyDays + 79;
  let leapG = Math.floor(gDays / 146097) * 400;
  gDays %= 146097;
  let addedY = Math.floor(gDays / 36524);
  if (addedY === 4) addedY = 3;
  leapG += addedY * 100;
  gDays %= 36524;
  leapG += Math.floor(gDays / 1461) * 4;
  gDays %= 1461;
  let addedY2 = Math.floor(gDays / 365);
  if (addedY2 === 4) addedY2 = 3;
  leapG += addedY2;
  gDays %= 365;
  
  const gMonthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapG = (leapG % 4 === 0 && leapG % 100 !== 0) || (leapG % 400 === 0);
  if (isLeapG) gMonthDays[2] = 29;

  let gMonth = 1;
  let gDay = gDays + 1;
  for (let i = 1; i <= 12; ++i) {
    const dim = gMonthDays[i];
    if (gDay <= dim) {
      gMonth = i;
      break;
    }
    gDay -= dim;
  }
  return [leapG, gMonth, gDay];
}

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gMonthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapG = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  if (isLeapG) gMonthDays[2] = 29;

  let gDays = gd;
  for (let i = 1; i < gm; ++i) {
    gDays += gMonthDays[i];
  }
  let jyDays = gDays - 79;
  let jy = gy - 621;

  if (jyDays <= 0) {
    jy -= 1;
    jyDays += isLeapJalali(jy) ? 366 : 365;
  }

  let jm = 1;
  let jd = jyDays;
  for (let i = 1; i <= 11; ++i) {
    const dim = i <= 6 ? 31 : 30;
    if (jd <= dim) {
      jm = i;
      break;
    }
    jd -= dim;
    jm = i + 1;
  }
  return [jy, jm, jd];
}

function getTodayJalali(): [number, number, number] {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// Convert numbers to Farsi digits for display
function toFarsiDigits(str: string | number): string {
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
}

// Convert Farsi digits to English
function toEnglishDigits(str: string): string {
  const farsiDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(farsiDigits[i], String(i));
  }
  return res;
}

const MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

interface ShamsiDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function ShamsiDatePicker({
  value,
  onChange,
  placeholder = "۱۴۰۳/۰۱/۰۱",
  className = "",
  required = false,
  disabled = false
}: ShamsiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to today
  const parseValue = (valStr: string): [number, number, number] => {
    const englishStr = toEnglishDigits(valStr);
    const parts = englishStr.split("/").map(Number);
    const today = getTodayJalali();
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return [parts[0], parts[1], parts[2]];
    }
    return today;
  };

  const initialVal = value ? parseValue(value) : getTodayJalali();
  const [year, setYear] = useState(initialVal[0]);
  const [month, setMonth] = useState(initialVal[1]);
  const [day, setDay] = useState(initialVal[2]);

  // Track panel view: "days", "months", "years"
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");

  // Keep date state in sync with external value changes
  useEffect(() => {
    if (value) {
      const parsed = parseValue(value);
      setYear(parsed[0]);
      setMonth(parsed[1]);
      setDay(parsed[2]);
    }
  }, [value]);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode("days");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDaySelect = (selectedDay: number) => {
    const formattedMonth = String(month).padStart(2, "0");
    const formattedDay = String(selectedDay).padStart(2, "0");
    const newVal = `${year}/${formattedMonth}/${formattedDay}`;
    onChange(newVal);
    setIsOpen(false);
  };

  const handleMonthSelect = (selectedMonth: number) => {
    setMonth(selectedMonth);
    setViewMode("days");
  };

  const handleYearSelect = (selectedYear: number) => {
    setYear(selectedYear);
    setViewMode("days");
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(prev => prev + 1);
    } else {
      setMonth(prev => prev + 1);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(prev => prev - 1);
    } else {
      setMonth(prev => prev - 1);
    }
  };

  const handleTodayClick = () => {
    const today = getTodayJalali();
    const formattedMonth = String(today[1]).padStart(2, "0");
    const formattedDay = String(today[2]).padStart(2, "0");
    const newVal = `${today[0]}/${formattedMonth}/${formattedDay}`;
    onChange(newVal);
    setIsOpen(false);
    setViewMode("days");
  };

  // Days calculations
  const getDaysInMonth = (y: number, m: number): number => {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    return isLeapJalali(y) ? 30 : 29;
  };

  const daysCount = getDaysInMonth(year, month);

  // Get Gregorian day of week for 1st day of month
  const getStartOffset = (): number => {
    const [gy, gm, gd] = jalaliToGregorian(year, month, 1);
    const d = new Date(gy, gm - 1, gd);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
    return (dayOfWeek + 1) % 7; // Map so that Saturday is 0, Sunday is 1, etc.
  };

  const startOffset = getStartOffset();

  // Generate Year Range (e.g., year - 15 to year + 10)
  const yearsList: number[] = [];
  const currentY = getTodayJalali()[0];
  for (let y = currentY - 20; y <= currentY + 10; y++) {
    yearsList.push(y);
  }

  const [todayYear, todayMonth, todayDay] = getTodayJalali();

  return (
    <div className="relative w-full" ref={containerRef} style={{ direction: "rtl" }}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`${className} pl-10 pr-3.5`}
          onFocus={() => setIsOpen(true)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-3.5 text-slate-400 hover:text-indigo-600 cursor-pointer p-1 rounded-md hover:bg-slate-50 transition-all"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex gap-1.5 font-bold text-xs text-slate-800">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "months" ? "days" : "months")}
                className="px-2 py-0.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors cursor-pointer"
              >
                {MONTH_NAMES[month - 1]}
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "years" ? "days" : "years")}
                className="px-2 py-0.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors cursor-pointer font-mono"
              >
                {toFarsiDigits(year)}
              </button>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* DAYS VIEW */}
          {viewMode === "days" && (
            <>
              {/* Week days header */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-2">
                {WEEK_DAYS.map((d, idx) => (
                  <div key={idx} className={idx === 6 ? "text-rose-400" : ""}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {/* Empty offsets */}
                {Array.from({ length: startOffset }).map((_, idx) => (
                  <div key={`empty-${idx}`} />
                ))}

                {/* Actual Days */}
                {Array.from({ length: daysCount }).map((_, idx) => {
                  const currentDayNum = idx + 1;
                  const isSelected = value && year === initialVal[0] && month === initialVal[1] && currentDayNum === initialVal[2];
                  const isToday = year === todayYear && month === todayMonth && currentDayNum === todayDay;

                  return (
                    <button
                      key={currentDayNum}
                      type="button"
                      onClick={() => handleDaySelect(currentDayNum)}
                      className={`text-xs font-mono py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white font-bold scale-105 shadow-xs"
                          : isToday
                          ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {toFarsiDigits(currentDayNum)}
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions Footer */}
              <div className="border-t border-slate-100 mt-3 pt-2.5 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer hover:underline"
                >
                  انتخاب امروز ({toFarsiDigits(`${todayYear}/${String(todayMonth).padStart(2, "0")}/${String(todayDay).padStart(2, "0")}`)})
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </>
          )}

          {/* MONTHS VIEW */}
          {viewMode === "months" && (
            <div className="grid grid-cols-3 gap-2 py-1">
              {MONTH_NAMES.map((name, idx) => {
                const mVal = idx + 1;
                const isSelected = month === mVal;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMonthSelect(mVal)}
                    className={`text-xs py-2 rounded-xl text-center font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {/* YEARS VIEW */}
          {viewMode === "years" && (
            <div className="max-h-[180px] overflow-y-auto grid grid-cols-3 gap-2 py-1 pr-1 scrollbar-thin">
              {yearsList.map((yVal, idx) => {
                const isSelected = year === yVal;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleYearSelect(yVal)}
                    className={`text-xs font-mono py-1.5 rounded-xl text-center font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {toFarsiDigits(yVal)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
