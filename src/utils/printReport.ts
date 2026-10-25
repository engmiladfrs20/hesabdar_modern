import { getTodayShamsiString } from "./shamsi";

export interface PrintColumn {
  header: string;
  key: string;
  align?: "right" | "center" | "left";
}

export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  filterDescription?: string;
  isFiltered?: boolean;
  totalRecordsBeforeFilter?: number;
  columns: PrintColumn[];
  rows: Record<string, string | number | undefined | null>[];
  summaryItems?: { label: string; value: string }[];
}

const toFarsiDigits = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null) return "—";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w, 10)]);
};

export function printStructuredReport(options: PrintReportOptions) {
  const {
    title,
    subtitle,
    companyName = "سامانه جامع حسابداری و مدیریت پروژه‌های ساختمانی",
    filterDescription,
    isFiltered = false,
    totalRecordsBeforeFilter,
    columns,
    rows,
    summaryItems = [],
  } = options;

  const printDate = toFarsiDigits(getTodayShamsiString());
  const modeBadge = isFiltered
    ? `گزارش فیلترشده (بعد از اعمال فیلتر) — تعداد رکورد نمایشی: ${toFarsiDigits(rows.length)}${
        totalRecordsBeforeFilter !== undefined
          ? ` از کل ${toFarsiDigits(totalRecordsBeforeFilter)} رکورد`
          : ""
      }`
    : `گزارش جامع کل اطلاعات (قبل از فیلتر / بدون فیلتر) — تعداد کل رکوردها: ${toFarsiDigits(rows.length)}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      font-family: Tahoma, "Vazirmatn", "IRANSans", sans-serif;
    }
    body {
      margin: 0;
      padding: 16px;
      direction: rtl;
      text-align: right;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
    }
    .header-box {
      border: 2px solid #1e293b;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-right h1 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .header-right h2 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .header-right p {
      margin: 0;
      font-size: 11px;
      color: #64748b;
    }
    .header-left {
      text-align: left;
      font-size: 11px;
      color: #334155;
      line-height: 1.7;
    }
    .filter-banner {
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid ${isFiltered ? "#6366f1" : "#10b981"};
      background: ${isFiltered ? "#eef2ff" : "#ecfdf5"};
      color: ${isFiltered ? "#312e81" : "#065f46"};
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 8px;
      font-size: 10.5px;
      vertical-align: middle;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 700;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .align-right { text-align: right; }
    .align-center { text-align: center; }
    .align-left { text-align: left; direction: ltr; unicode-bidi: embed; }
    .summary-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f1f5f9;
    }
    .summary-item {
      padding: 4px 10px;
      border-left: 1px solid #cbd5e1;
    }
    .summary-item:last-child {
      border-left: none;
    }
    .summary-label {
      font-size: 10px;
      color: #64748b;
      display: block;
    }
    .summary-val {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer-sign {
      margin-top: 24px;
      display: flex;
      justify-content: space-around;
      padding-top: 12px;
      border-top: 1px dashed #94a3b8;
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-right">
      <h1>${companyName}</h1>
      <h2>${title}</h2>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </div>
    <div class="header-left">
      <div><strong>تاریخ چاپ:</strong> ${printDate}</div>
      <div><strong>تعداد ردیف‌ها:</strong> ${toFarsiDigits(rows.length)} مورد</div>
    </div>
  </div>

  <div class="filter-banner">
    <span>${modeBadge}</span>
    ${filterDescription ? `<span>جزئیات فیلتر: ${filterDescription}</span>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th class="align-center" style="width: 42px;">ردیف</th>
        ${columns
          .map(
            (col) =>
              `<th class="align-${col.align || "right"}">${col.header}</th>`
          )
          .join("")}
      </tr>
    </thead>
    <tbody>
      ${
        rows.length === 0
          ? `<tr><td colspan="${columns.length + 1}" class="align-center" style="padding: 20px;">هیچ رکوردی جهت نمایش وجود ندارد.</td></tr>`
          : rows
              .map(
                (row, idx) => `
        <tr>
          <td class="align-center">${toFarsiDigits(idx + 1)}</td>
          ${columns
            .map(
              (col) =>
                `<td class="align-${col.align || "right"}">${toFarsiDigits(
                  row[col.key] ?? "—"
                )}</td>`
            )
            .join("")}
        </tr>`
              )
              .join("")
      }
    </tbody>
  </table>

  ${
    summaryItems.length > 0
      ? `<div class="summary-grid">
          ${summaryItems
            .map(
              (item) => `
            <div class="summary-item">
              <span class="summary-label">${item.label}</span>
              <span class="summary-val">${toFarsiDigits(item.value)}</span>
            </div>`
            )
            .join("")}
        </div>`
      : ""
  }

  <div class="footer-sign">
    <div>مهر و امضای تنظیم‌کننده / حسابدار</div>
    <div>مهر و امضای ناظر / سرپرست کارگاه</div>
    <div>مهر و امضای مدیریت ارشد پروژه</div>
  </div>
</body>
</html>`;

  const existingFrame = document.getElementById("print-report-iframe");
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "print-report-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  }
}
