export function toEnglishDigits(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
}

export function cleanNumericInput(str: string | number | undefined | null, allowDecimal: boolean = true): string {
  const eng = toEnglishDigits(str);
  if (allowDecimal) {
    const cleaned = eng.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  }
  return eng.replace(/[^0-9]/g, "");
}
