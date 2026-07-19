export interface PredefinedMaterial {
  code: string;
  name: string;
  category: string;
  subCategory?: string;
  unit: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  consumptionType: "concrete" | "steel" | "common";
}

export const PREDEFINED_MATERIALS: PredefinedMaterial[] = [
  // 1- مصالح خاکبرداری و زیرسازی
  { code: "MAT-101", name: "خاک دستی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-102", name: "خاکبرداری مکانیکی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-103", name: "خاک پرکنی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-104", name: "خاک کوبیده", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-105", name: "شن نخودی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-106", name: "شن بادامی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-107", name: "شن درشت", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-108", name: "ماسه شسته", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-109", name: "ماسه دوبارشور", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-110", name: "ماسه بادی", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-111", name: "قلوه سنگ", category: "خاکبرداری و زیرسازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-112", name: "ژئوتکستایل", category: "خاکبرداری و زیرسازی", unit: "متر مربع", consumptionType: "common" },

  // 2- فونداسیون
  { code: "MAT-201", name: "بتن مگر", category: "فونداسیون", unit: "متر مکعب", consumptionType: "concrete" },
  { code: "MAT-202", name: "بتن فونداسیون", category: "فونداسیون", unit: "متر مکعب", consumptionType: "concrete" },
  { code: "MAT-203", name: "سیمان پرتلند تیپ ۲", category: "فونداسیون", subCategory: "سیمان", unit: "تن", secondaryUnit: "کیسه", conversionFactor: 20, consumptionType: "concrete" },
  { code: "MAT-204", name: "میلگرد فونداسیون", category: "فونداسیون", subCategory: "میلگرد", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 15, consumptionType: "concrete" },
  { code: "MAT-205", name: "سیم آرماتوربندی", category: "فونداسیون", unit: "کیلوگرم", consumptionType: "concrete" },
  { code: "MAT-206", name: "اسپیسر فونداسیون", category: "فونداسیون", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-207", name: "قالب فلزی فونداسیون", category: "فونداسیون", unit: "متر مربع", consumptionType: "concrete" },
  { code: "MAT-208", name: "روغن قالب", category: "فونداسیون", unit: "لیتر", consumptionType: "concrete" },
  { code: "MAT-209", name: "بولت فونداسیون", category: "فونداسیون", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-210", name: "صفحه ستون", category: "فونداسیون", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-211", name: "گروت شاسی", category: "فونداسیون", unit: "کیلوگرم", secondaryUnit: "کیسه ۲۵کيلویی", conversionFactor: 0.04, consumptionType: "common" },

  // 3- اسکلت بتنی
  { code: "MAT-301", name: "میلگرد ستون", category: "اسکلت بتنی", subCategory: "میلگرد", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 18, consumptionType: "concrete" },
  { code: "MAT-302", name: "میلگرد تیر", category: "اسکلت بتنی", subCategory: "میلگرد", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 20, consumptionType: "concrete" },
  { code: "MAT-303", name: "میلگرد سقف", category: "اسکلت بتنی", subCategory: "میلگرد", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 12, consumptionType: "concrete" },
  { code: "MAT-304", name: "خاموت آماده", category: "اسکلت بتنی", unit: "کیلوگرم", consumptionType: "concrete" },
  { code: "MAT-305", name: "بتن ستون C30", category: "اسکلت بتنی", unit: "متر مکعب", consumptionType: "concrete" },
  { code: "MAT-306", name: "بتن تیر C30", category: "اسکلت بتنی", unit: "متر مکعب", consumptionType: "concrete" },
  { code: "MAT-307", name: "بتن سقف C25", category: "اسکلت بتنی", unit: "متر مکعب", consumptionType: "concrete" },
  { code: "MAT-308", name: "اسپیسر بتنی و پلاستیکی", category: "اسکلت بتنی", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-309", name: "قالب فلزی ستون و تیر", category: "اسکلت بتنی", unit: "متر مربع", consumptionType: "concrete" },
  { code: "MAT-310", name: "جک سقفی صلیب‌دار", category: "اسکلت بتنی", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-311", name: "لوله داربست سنگین", category: "اسکلت بتنی", unit: "متر طول", secondaryUnit: "شاخه ۶ متری", conversionFactor: 6, consumptionType: "common" },

  // 4- اسکلت فلزی
  { code: "MAT-401", name: "تیرآهن IPE", category: "اسکلت فلزی", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 120, consumptionType: "steel" },
  { code: "MAT-402", name: "تیرآهن هاش IPB", category: "اسکلت فلزی", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 250, consumptionType: "steel" },
  { code: "MAT-403", name: "ناودانی UNP", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-404", name: "نبشی L", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-405", name: "سپری T", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-406", name: "قوطی پروفیل صنعتی", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-407", name: "ورق سیاه فولاد مبارکه", category: "اسکلت فلزی", unit: "کیلوگرم", secondaryUnit: "شیت", conversionFactor: 150, consumptionType: "steel" },
  { code: "MAT-408", name: "ورق گالوانیزه تاراز", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-409", name: "پیچ و مهره گرید 8.8", category: "اسکلت فلزی", unit: "عدد", secondaryUnit: "کیلوگرم", conversionFactor: 0.15, consumptionType: "steel" },
  { code: "MAT-410", name: "الکترود جوشکاری آما ۳۶", category: "اسکلت فلزی", unit: "کیلوگرم", secondaryUnit: "کارتن", conversionFactor: 5, consumptionType: "steel" },
  { code: "MAT-411", name: "سیم جوش CO2", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-412", name: "کپسول گاز CO2", category: "اسکلت فلزی", unit: "کپسول", consumptionType: "steel" },
  { code: "MAT-413", name: "ضد زنگ اخرایی طوسی", category: "اسکلت فلزی", unit: "کیلوگرم", secondaryUnit: "گالن", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-414", name: "رنگ صنعتی اپوکسی", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-415", name: "انکربولت مکانیکی", category: "اسکلت فلزی", unit: "عدد", consumptionType: "steel" },
  { code: "MAT-416", name: "بیس پلیت ضخیم", category: "اسکلت فلزی", unit: "کیلوگرم", consumptionType: "steel" },

  // 5- سقف (تیرچه بلوک)
  { code: "MAT-501", name: "تیرچه کرومیت و بتنی", category: "سقف", subCategory: "تیرچه بلوک", unit: "متر طول", consumptionType: "concrete" },
  { code: "MAT-502", name: "بلوک سفالی سقف ۲۰", category: "سقف", subCategory: "تیرچه بلوک", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-503", name: "بلوک سیمانی سبک سقف", category: "سقف", subCategory: "تیرچه بلوک", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-504", name: "یونولیت سقفی استاندارد کندسوز", category: "سقف", subCategory: "تیرچه بلوک", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-505", name: "میلگرد حرارتی سایز ۶ و ۸", category: "سقف", subCategory: "تیرچه بلوک", unit: "کیلوگرم", consumptionType: "concrete" },
  { code: "MAT-506", name: "بتن سقف آماده C20", category: "سقف", subCategory: "تیرچه بلوک", unit: "متر مکعب", consumptionType: "concrete" },

  // 5- سقف (کامپوزیت و عرشه فولادی)
  { code: "MAT-511", name: "ورق عرشه فولادی گالوانیزه", category: "سقف", subCategory: "عرشه فولادی", unit: "متر مربع", consumptionType: "steel" },
  { code: "MAT-512", name: "گل میخ استاندارد سقف", category: "سقف", subCategory: "عرشه فولادی", unit: "عدد", consumptionType: "steel" },
  { code: "MAT-513", name: "میلگرد حرارتی عرشه", category: "سقف", subCategory: "عرشه فولادی", unit: "کیلوگرم", consumptionType: "steel" },
  { code: "MAT-514", name: "بتن روی عرشه فولادی", category: "سقف", subCategory: "عرشه فولادی", unit: "متر مکعب", consumptionType: "steel" },

  // 5- سقف (وافل)
  { code: "MAT-521", name: "قالب وافل موقت و دوطرفه", category: "سقف", subCategory: "وافل", unit: "عدد", consumptionType: "concrete" },
  { code: "MAT-522", name: "میلگرد بافت سقف وافل", category: "سقف", subCategory: "وافل", unit: "کیلوگرم", consumptionType: "concrete" },
  { code: "MAT-523", name: "بتن سقف وافل", category: "سقف", subCategory: "وافل", unit: "متر مکعب", consumptionType: "concrete" },

  // 6- دیوارچینی
  { code: "MAT-601", name: "آجر فشاری ملاتی", category: "دیوارچینی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-602", name: "آجر سفال تیغه ۱۵", category: "دیوارچینی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-603", name: "بلوک سیمانی ته بسته سبک", category: "دیوارچینی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-604", name: "بلوک لیکا دیواری صوتی", category: "دیوارچینی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-605", name: "بلوک هبلکس AAC عایق حرارتی", category: "دیوارچینی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-606", name: "ملات ماسه سیمان آماده", category: "دیوارچینی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-607", name: "سیمان پرتلند تیپ ۱ کیسه", category: "دیوارچینی", unit: "کیسه", consumptionType: "common" },
  { code: "MAT-608", name: "وال پست ناودانی منقطع", category: "دیوارچینی", unit: "کیلوگرم", secondaryUnit: "شاخه", conversionFactor: 8.5, consumptionType: "common" },
  { code: "MAT-609", name: "میلگرد بستر گالوانیزه", category: "دیوارچینی", unit: "متر طول", secondaryUnit: "جفت شاخه ۳متری", conversionFactor: 3, consumptionType: "common" },
  { code: "MAT-610", name: "فوم پلی اتیلن ژوئن انقطاع", category: "دیوارچینی", unit: "متر طول", consumptionType: "common" },

  // 7- ایزولاسیون
  { code: "MAT-701", name: "ایزوگام دلاور دلیجان فویلدار", category: "ایزولاسیون", unit: "متر مربع", secondaryUnit: "رول ۱۰متری", conversionFactor: 10, consumptionType: "common" },
  { code: "MAT-702", name: "قیر بشکه‌ای ۶۰-۷۰", category: "ایزولاسیون", unit: "کیلوگرم", secondaryUnit: "بشکه", conversionFactor: 180, consumptionType: "common" },
  { code: "MAT-703", name: "گونی چتایی درجه ۲ بنگال", category: "ایزولاسیون", unit: "متر مربع", secondaryUnit: "یارد", conversionFactor: 0.914, consumptionType: "common" },
  { code: "MAT-704", name: "عایق رطوبتی دو جزئی مایع", category: "ایزولاسیون", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-705", name: "عایق نانو استخر و سرویس", category: "ایزولاسیون", unit: "لیتر", secondaryUnit: "گالن", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-706", name: "فوم عایق XPS دانسیته بالا", category: "ایزولاسیون", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-707", name: "پشم سنگ تخته‌ای ۵ سانت", category: "ایزولاسیون", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-708", name: "پشم شیشه رولی فویلدار", category: "ایزولاسیون", unit: "متر مربع", consumptionType: "common" },

  // 8- تأسیسات مکانیکی
  { code: "MAT-801", name: "لوله پنج لایه نیوپایپ", category: "تأسیسات مکانیکی", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-802", name: "لوله پلیکا پی‌وی‌سی فاضلابی", category: "تأسیسات مکانیکی", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-803", name: "لوله پوش‌فیت وحید بی صدا", category: "تأسیسات مکانیکی", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-804", name: "لوله گالوانیزه سپنتا", category: "تأسیسات مکانیکی", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-805", name: "لوله گاز مانیسمان بدون درز", category: "تأسیسات مکانیکی", unit: "متر طول", secondaryUnit: "شاخه ۶متری", conversionFactor: 6, consumptionType: "common" },
  { code: "MAT-811", name: "اتصالات برنجی و پلیمری", category: "تأسیسات مکانیکی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-812", name: "شیر فلکه کشویی برنجی کیتز", category: "تأسیسات مکانیکی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-813", name: "شیرآلات بهداشتی اهرمی درجه۱", category: "تأسیسات مکانیکی", unit: "عدد", secondaryUnit: "دست کامل", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-814", name: "کلکتور برنجی رفت و برگشت", category: "تأسیسات مکانیکی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-821", name: "پمپ آب سه اسب پنتاکس", category: "تأسیسات مکانیکی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-822", name: "مخزن آب پلی‌اتیلن سه لایه", category: "تأسیسات مکانیکی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-823", name: "پکیج دیواری ۲۴ هزار بوتان", category: "تأسیسات مکانیکی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-824", name: "رادیاتور پنلی فولادی ایساتیس", category: "تأسیسات مکانیکی", unit: "پره", consumptionType: "common" },
  { code: "MAT-825", name: "فن کویل سقفی توکار", category: "تأسیسات مکانیکی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-826", name: "چیلر تراکمی هواخنک", category: "تأسیسات مکانیکی", unit: "دستگاه", consumptionType: "common" },

  // 9- تأسیسات برقی
  { code: "MAT-901", name: "سیم برق افشان افشارنژاد", category: "تأسیسات برقی", unit: "متر", secondaryUnit: "کلاف ۱۰۰متری", conversionFactor: 100, consumptionType: "common" },
  { code: "MAT-902", name: "کابل برق مسی شیلددار", category: "تأسیسات برقی", unit: "متر", consumptionType: "common" },
  { code: "MAT-903", name: "لوله برق پی‌وی‌سی نسوز", category: "تأسیسات برقی", unit: "متر", secondaryUnit: "شاخه ۶متری", conversionFactor: 6, consumptionType: "common" },
  { code: "MAT-904", name: "قوطی کلید و پریز رابط‌دار", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-905", name: "کلیدهای تک‌پل و دوپل لوکس", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-906", name: "پریز برق ارت‌دار و تلفن", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-907", name: "فیوز مینیاتوری لگراند", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-908", name: "تابلو برق توکار مینیاتوری", category: "تأسیسات برقی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-909", name: "چراغ سقفی و توکار پنلی", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-910", name: "هالوژن اس‌ام‌دی فوق کم‌مصرف", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-911", name: "کابل شبکه Cat6 SFTP نگزنس", category: "تأسیسات برقی", unit: "متر", secondaryUnit: "قرقره ۳۰۵متری", conversionFactor: 305, consumptionType: "common" },
  { code: "MAT-912", name: "سوکت شبکه و کیستون کیبلر", category: "تأسیسات برقی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-913", name: "آیفون تصویری ۱۰ اینچ تکنما", category: "تأسیسات برقی", unit: "دستگاه", consumptionType: "common" },
  { code: "MAT-914", name: "دوربین مداربسته IP داهوا ۵مگ", category: "تأسیسات برقی", unit: "دستگاه", consumptionType: "common" },

  // 10- نازک کاری
  { code: "MAT-1001", name: "گچ سفید کاری ساوه طلایی", category: "نازک کاری", unit: "کیسه", consumptionType: "common" },
  { code: "MAT-1002", name: "خاک رس مرغوب کوره", category: "نازک کاری", unit: "کیسه", consumptionType: "common" },
  { code: "MAT-1003", name: "سیمان سفید ساوه ۵۰کيلویی", category: "نازک کاری", unit: "کیسه", consumptionType: "common" },
  { code: "MAT-1004", name: "پودر سنگ الک شده الوند", category: "نازک کاری", unit: "کیلوگرم", secondaryUnit: "کیسه ۲۵کيلویی", conversionFactor: 25, consumptionType: "common" },
  { code: "MAT-1005", name: "کاشی بدنه کالیبره تبریز", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1006", name: "سرامیک کف پرسلان تکسرام", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1007", name: "سنگ پله و کف هرسین دهبید", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1008", name: "چسب کاشی پودری هنکل", category: "نازک کاری", unit: "کیسه", consumptionType: "common" },
  { code: "MAT-1009", name: "دوغاب و پودر بندکشی نانو", category: "نازک کاری", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1010", name: "رنگ پلاستیک سقف هادی", category: "نازک کاری", unit: "کیلوگرم", secondaryUnit: "گالن", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-1011", name: "رنگ روغنی الکیدی مات و براق", category: "نازک کاری", unit: "کیلوگرم", secondaryUnit: "گالن", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-1012", name: "رنگ اکریلیک پایه آب بی‌بو", category: "نازک کاری", unit: "کیلوگرم", secondaryUnit: "گالن", conversionFactor: 4, consumptionType: "common" },
  { code: "MAT-1013", name: "بتنه آماده همه‌کاره", category: "نازک کاری", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1014", name: "سنباده کاغذی نرم و زبر", category: "نازک کاری", unit: "برگ", consumptionType: "common" },
  { code: "MAT-1015", name: "قرنیز سنگی یا ام‌دی‌اف ۹سانت", category: "نازک کاری", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-1016", name: "پارکت لمینت آلمانی کایسر", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1017", name: "لمینت ایرانی کیفیت ممتاز", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1018", name: "کفپوش PVC ضد آب و سایش", category: "نازک کاری", unit: "متر مربع", consumptionType: "common" },

  // 11- نما
  { code: "MAT-1101", name: "سنگ تراورتن عباس‌آباد سوپر", category: "نما", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1102", name: "آجر نما نسوز شاموتی انگلیسی", category: "نما", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1103", name: "سرامیک خشک پرسلانی نما", category: "نما", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1104", name: "کامپوزیت آلومینیوم آلکوباند", category: "نما", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1105", name: "قوطی و نبشی زیرسازی نما", category: "نما", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1106", name: "اسکوپ پروانه‌ای سنگ نما", category: "نما", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1107", name: "پیچ و رولپلاک واشرخور گالوانیزه", category: "نما", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1108", name: "چسب سنگ جلاسنج مگافوکس", category: "نما", unit: "کیلوگرم", consumptionType: "common" },

  // 12- درب و پنجره
  { code: "MAT-1201", name: "درب ضد سرقت ترک روکش راش", category: "درب و پنجره", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1202", name: "درب داخلی ملامینه HDF", category: "درب و پنجره", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1203", name: "پنجره UPVC هافمن با گالوانیزه", category: "درب و پنجره", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1204", name: "پنجره آلومینیوم ترمال‌بریک", category: "درب و پنجره", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1205", name: "شیشه دوجداره ۶و۴میل با گاز آرگون", category: "درب و پنجره", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1206", name: "یراق‌آلات پنجره دو حالته روتو", category: "درب و پنجره", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1207", name: "نرده استیل پله و بالکن ۳۰۴", category: "درب و پنجره", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-1208", name: "حفاظ فرفورژه ورودی و پنجره", category: "درب و پنجره", unit: "متر مربع", consumptionType: "common" },

  // 13- کابینت و دکوراسیون
  { code: "MAT-1301", name: "ام‌دی‌اف سفید صابونی پاک چوب", category: "کابینت و دکوراسیون", unit: "ورق", consumptionType: "common" },
  { code: "MAT-1302", name: "ام‌دی‌اف هایگلاس ایشیک ترک", category: "کابینت و دکوراسیون", unit: "ورق", consumptionType: "common" },
  { code: "MAT-1303", name: "دیوارپوش پی‌وی‌سی هوم لوکس", category: "کابینت و دکوراسیون", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1304", name: "صفحه کابینت کورین سامسونگ", category: "کابینت و دکوراسیون", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-1305", name: "یراق‌آلات کابینت لولا گازور پمپ", category: "کابینت و دکوراسیون", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1306", name: "کمد دیواری ملامینه ریلی", category: "کابینت و دکوراسیون", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1307", name: "سقف کاذب تایل ۶۰*۶۰ پی‌وی‌سی", category: "کابینت و دکوراسیون", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1308", name: "صفحه گچی کناف ایران RG", category: "کابینت و دکوراسیون", unit: "متر مربع", consumptionType: "common" },

  // 14- محوطه سازی
  { code: "MAT-1401", name: "موزاییک میبد پرسلانی کف", category: "محوطه سازی", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1402", name: "واش بتن چراغ‌دار حیاط خلوت", category: "محوطه سازی", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1403", name: "جدول سیمانی پرسی دور باغچه", category: "محوطه سازی", unit: "متر طول", consumptionType: "common" },
  { code: "MAT-1404", name: "سنگ فرش کوبیک نامنظم مشهد", category: "محوطه سازی", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1405", name: "چمن مصنوعی تراکم بالا ۳۰میل", category: "محوطه سازی", unit: "متر مربع", consumptionType: "common" },
  { code: "MAT-1406", name: "خاک باغچه ارگانیک مغذی", category: "محوطه سازی", unit: "متر مکعب", consumptionType: "common" },
  { code: "MAT-1407", name: "گیاهان تزیینی همیشه سبز شمشاد", category: "محوطه سازی", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1408", name: "درخت تزیینی کاج مطبق و بید", category: "محوطه سازی", unit: "اصله", consumptionType: "common" },

  // 15- اقلام عمومی مصرفی کارگاه
  { code: "MAT-1501", name: "میخ نجاری گالوانیزه ۵ و ۸سانت", category: "اقلام عمومی کارگاه", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1502", name: "پیچ ام‌دی‌اف و پیچ خودکار سیاه", category: "اقلام عمومی کارگاه", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1503", name: "رولپلاک پلاستیکی درجه۱ یاسر", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1504", name: "بست لوله داربست فولادی", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1505", name: "چسب سیلیکون ضد آب آکفیکس", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1506", name: "فوم پلی‌اورتان اسپری آکفیکس", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1507", name: "نوار تفلون دنا یا تهران", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1508", name: "چسب برق سینا گرید ممتاز", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1509", name: "نایلون عریض فونداسیون ضخیم", category: "اقلام عمومی کارگاه", unit: "کیلوگرم", consumptionType: "common" },
  { code: "MAT-1510", name: "گونی کنفی خالی نخاله ساختمان", category: "اقلام عمومی کارگاه", unit: "عدد", consumptionType: "common" },
  { code: "MAT-1511", name: "طناب پلاستیکی نمره ۱۰ ضخیم", category: "اقلام عمومی کارگاه", unit: "متر", consumptionType: "common" },
  { code: "MAT-1512", name: "برزنت پوشش داربست ضد آب", category: "اقلام عمومی کارگاه", unit: "متر مربع", consumptionType: "common" }
];
