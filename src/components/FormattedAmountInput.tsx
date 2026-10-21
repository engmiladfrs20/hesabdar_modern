import React, { useState, useEffect } from "react";
import { toEnglishDigits } from "../utils/digits";

interface FormattedAmountInputProps {
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function FormattedAmountInput({
  value,
  onChange,
  placeholder = "مثال: ۵,۰۰۰,۰۰۰",
  className = "",
  required = false,
  disabled = false,
  id
}: FormattedAmountInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  const formatWithCommas = (val: string | number): string => {
    if (val === undefined || val === null || val === "") return "";
    const engStr = toEnglishDigits(String(val));
    const isNegative = engStr.trim().startsWith("-");
    const cleanStr = engStr.replace(/,/g, "").replace(/[^\d]/g, "");
    if (!cleanStr) return isNegative ? "-" : "";
    const normalized = cleanStr.replace(/^0+(?=\d)/, "");
    return (isNegative ? "-" : "") + normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  useEffect(() => {
    setDisplayValue(formatWithCommas(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const englishInput = toEnglishDigits(rawInput);

    const isNegative = englishInput.trim().startsWith("-");
    const digitsOnly = englishInput.replace(/,/g, "").replace(/[^\d]/g, "");
    const normalized = digitsOnly.replace(/^0+(?=\d)/, "");

    const finalDisplay = normalized
      ? (isNegative ? "-" : "") + normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      : isNegative
      ? "-"
      : "";
    setDisplayValue(finalDisplay);

    onChange(normalized ? (isNegative ? "-" : "") + normalized : isNegative ? "-" : "");
  };

  return (
    <input
      type="text"
      id={id}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
      inputMode="numeric"
      style={{ direction: "ltr" }}
    />
  );
}
