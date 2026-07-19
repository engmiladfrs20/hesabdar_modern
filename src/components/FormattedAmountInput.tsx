import React, { useState, useEffect } from "react";

interface FormattedAmountInputProps {
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
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

export function FormattedAmountInput({
  value,
  onChange,
  placeholder = "مثال: ۵,۰۰۰,۰۰۰",
  className = "",
  required = false,
  disabled = false,
  id
}: FormattedAmountInputProps) {
  // Local state to manage the formatted string
  const [displayValue, setDisplayValue] = useState("");

  const formatWithCommas = (val: string | number): string => {
    if (val === undefined || val === null || val === "") return "";
    // convert farsi to english
    const engStr = toEnglishDigits(String(val));
    const isNegative = engStr.trim().startsWith("-");
    // extract digits
    const cleanStr = engStr.replace(/,/g, "").replace(/[^\d]/g, "");
    if (!cleanStr) return isNegative ? "-" : "";
    return (isNegative ? "-" : "") + Number(cleanStr).toLocaleString("en-US");
  };

  useEffect(() => {
    setDisplayValue(formatWithCommas(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const englishInput = toEnglishDigits(rawInput);
    
    const isNegative = englishInput.trim().startsWith("-");
    // Extract only numbers/digits
    const digitsOnly = englishInput.replace(/,/g, "").replace(/[^\d]/g, "");
    
    // Set formatted version locally so the input cursor/rendering feels smooth
    const finalDisplay = digitsOnly ? (isNegative ? "-" : "") + Number(digitsOnly).toLocaleString("en-US") : (isNegative ? "-" : "");
    setDisplayValue(finalDisplay);
    
    // Notify parent state of the clean string
    onChange(digitsOnly ? (isNegative ? "-" : "") + digitsOnly : (isNegative ? "-" : ""));
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
