/**
 * Static demo catalog. ALL names (people, drugstores, pharmacies, brands,
 * competitors) are fictional and exist only to demonstrate the platform.
 * Generic (INN) names are real molecules; brand names are invented.
 */
import type { Role } from "@/lib/auth/permissions";

export const DEMO_PASSWORD = "Demo@2026";

export const TERRITORIES = [
  { id: 1, code: "BGD", nameEn: "Baghdad", nameAr: "بغداد" },
  { id: 2, code: "STH", nameEn: "South (Basra)", nameAr: "الجنوب (البصرة)" },
  { id: 3, code: "KRD", nameEn: "Kurdistan Region", nameAr: "إقليم كردستان" },
  { id: 4, code: "NTH", nameEn: "North (Nineveh)", nameAr: "الشمال (نينوى)" },
  { id: 5, code: "MEU", nameEn: "Middle Euphrates", nameAr: "الفرات الأوسط" },
] as const;

export type DemoUserKey =
  | "director" | "salesManager" | "areaBaghdad" | "areaSouth" | "repAli" | "repZainab"
  | "repOmar" | "medSara" | "medYousif" | "finance" | "admin";

export const USERS: Record<
  DemoUserKey,
  { email: string; fullName: string; fullNameAr: string; role: Role; territoryId: number | null }
> = {
  director: { email: "director@demo.iq", fullName: "Dr. Kareem Al-Saadi", fullNameAr: "د. كريم الساعدي", role: "director", territoryId: null },
  salesManager: { email: "sales.manager@demo.iq", fullName: "Noor Al-Hashimi", fullNameAr: "نور الهاشمي", role: "sales_manager", territoryId: null },
  areaBaghdad: { email: "area.baghdad@demo.iq", fullName: "Mustafa Jassim", fullNameAr: "مصطفى جاسم", role: "area_manager", territoryId: 1 },
  areaSouth: { email: "area.south@demo.iq", fullName: "Hassan Abdulkareem", fullNameAr: "حسن عبد الكريم", role: "area_manager", territoryId: 2 },
  repAli: { email: "rep.ali@demo.iq", fullName: "Ali Kadhim", fullNameAr: "علي كاظم", role: "sales_rep", territoryId: 1 },
  repZainab: { email: "rep.zainab@demo.iq", fullName: "Zainab Mohammed", fullNameAr: "زينب محمد", role: "sales_rep", territoryId: 5 },
  repOmar: { email: "rep.omar@demo.iq", fullName: "Omar Rashid", fullNameAr: "عمر رشيد", role: "sales_rep", territoryId: 3 },
  medSara: { email: "medrep.sara@demo.iq", fullName: "Sara Abdullah", fullNameAr: "سارة عبد الله", role: "medical_rep", territoryId: 1 },
  medYousif: { email: "medrep.yousif@demo.iq", fullName: "Yousif Hamid", fullNameAr: "يوسف حامد", role: "medical_rep", territoryId: 5 },
  finance: { email: "finance@demo.iq", fullName: "Rana Tariq", fullNameAr: "رنا طارق", role: "finance", territoryId: null },
  admin: { email: "admin@demo.iq", fullName: "System Administrator", fullNameAr: "مسؤول النظام", role: "admin", territoryId: null },
};

/**
 * Behavioural profile used by the generator.
 * - invoicesPerMonth: baseline order frequency
 * - qtyScale: order size multiplier
 * - trend(monthsAgo): multiplier on frequency (0 = current month)
 * - payDays(invoiceAgeDays): days from invoice to payment; null = not paid
 * - returnRate: share of sales value returned over the year
 */
export type DrugstoreProfile = {
  invoicesPerMonth: number;
  qtyScale: number;
  trend: (monthsAgo: number) => number;
  payDays: (invoiceAgeDays: number, rnd: () => number) => number | null;
  partialProb: number;
  returnRate: number;
  targetUtilisation: number;
  products: string[];
};

export type DemoDrugstore = {
  id: number;
  code: string;
  name: string;
  nameAr: string;
  territoryId: number;
  city: string;
  address: string;
  contactPerson: string;
  phone: string;
  rep: DemoUserKey;
  manager: DemoUserKey;
  scenario: string;
  profile: DrugstoreProfile;
};

const between = (rnd: () => number, a: number, b: number) => Math.round(a + rnd() * (b - a));

// Product codes referenced by scenarios.
export const SCENARIO_PRODUCTS = {
  fastMoving: "P001", // Glucotrin 500 mg — fast moving
  slowReorder: "P014", // Osteval 70 mg — reorders fading
  expiryExposure: "P007", // Glimetra 1 mg — short-dated batch, no reorder
  priceErosion: "P010", // Rosuvan 10 mg — low market price reports
  inconsistency: "P020", // Gastrozol 40 mg — reported slow, but reorders strong
} as const;

const CORE = ["P001", "P002", "P003", "P004", "P005", "P010", "P011", "P012", "P020", "P021", "P022", "P030"];

export const DRUGSTORES: DemoDrugstore[] = [
  {
    id: 1, code: "DS-001", name: "Al-Noor Medical Store", nameAr: "مذخر النور الطبي", territoryId: 1, city: "Baghdad",
    address: "Al-Mansour, Karkh", contactPerson: "Ahmed Fadhil", phone: "+964 770 100 0001", rep: "repAli", manager: "areaBaghdad",
    scenario: "High sales, high outstanding, payment deteriorating (≈76 → ≈101 days)",
    profile: {
      invoicesPerMonth: 7, qtyScale: 1.45, trend: (m) => (m <= 3 ? 1.25 : 1),
      payDays: (age, r) => (age > 240 ? between(r, 70, 82) : age > 150 ? between(r, 92, 108) : between(r, 100, 118)),
      partialProb: 0.15, returnRate: 0.012, targetUtilisation: 0.94,
      products: [...CORE, "P007", "P013", "P014", "P023", "P031", "P032"],
    },
  },
  {
    id: 2, code: "DS-002", name: "Al-Shifa Drugstore", nameAr: "مذخر الشفاء", territoryId: 1, city: "Baghdad",
    address: "Palestine St., Rusafa", contactPerson: "Mohammed Saleh", phone: "+964 770 100 0002", rep: "repAli", manager: "areaBaghdad",
    scenario: "Healthy: sales increasing, collections on time",
    profile: {
      invoicesPerMonth: 5, qtyScale: 1.0, trend: (m) => 1.5 - m * 0.045,
      payDays: (_age, r) => between(r, 72, 88), partialProb: 0.03, returnRate: 0.006, targetUtilisation: 0.55,
      products: [...CORE, "P006", "P015", "P016", "P024", "P033"],
    },
  },
  {
    id: 3, code: "DS-003", name: "Dar Al-Dawaa Medical", nameAr: "مذخر دار الدواء", territoryId: 2, city: "Basra",
    address: "Al-Ashar", contactPerson: "Kadhim Jabbar", phone: "+964 780 200 0003", rep: "repZainab", manager: "areaSouth",
    scenario: "Moderate sales, high return behaviour",
    profile: {
      invoicesPerMonth: 4, qtyScale: 0.9, trend: () => 1,
      payDays: (_age, r) => between(r, 84, 100), partialProb: 0.08, returnRate: 0.095, targetUtilisation: 0.62,
      products: [...CORE, "P007", "P008", "P017", "P025", "P034", "P035"],
    },
  },
  {
    id: 4, code: "DS-004", name: "Ibn Sina Medical Supplies", nameAr: "مذخر ابن سينا", territoryId: 3, city: "Erbil",
    address: "100m Road", contactPerson: "Karwan Aziz", phone: "+964 750 300 0004", rep: "repOmar", manager: "salesManager",
    scenario: "Strong payer, stable reorder, moderate sales",
    profile: {
      invoicesPerMonth: 4, qtyScale: 0.85, trend: () => 1,
      payDays: (_age, r) => between(r, 52, 66), partialProb: 0, returnRate: 0.004, targetUtilisation: 0.35,
      products: [...CORE, "P009", "P018", "P026", "P036"],
    },
  },
  {
    id: 5, code: "DS-005", name: "Al-Rafidain Drugstore", nameAr: "مذخر الرافدين", territoryId: 4, city: "Mosul",
    address: "Al-Zuhoor", contactPerson: "Younis Thanoon", phone: "+964 770 400 0005", rep: "repOmar", manager: "salesManager",
    scenario: "Weak reorder pattern in the last four months",
    profile: {
      invoicesPerMonth: 4, qtyScale: 0.8, trend: (m) => (m <= 3 ? 0.3 : 1),
      payDays: (_age, r) => between(r, 85, 98), partialProb: 0.05, returnRate: 0.01, targetUtilisation: 0.4,
      products: [...CORE, "P014", "P019", "P027", "P037"],
    },
  },
  {
    id: 6, code: "DS-006", name: "Babil Pharma Store", nameAr: "مذخر بابل", territoryId: 5, city: "Hillah",
    address: "Bab Al-Hussain", contactPerson: "Abbas Hamza", phone: "+964 781 500 0006", rep: "repZainab", manager: "salesManager",
    scenario: "Information inconsistency: reports slow movement while reordering strongly",
    profile: {
      invoicesPerMonth: 4, qtyScale: 0.9, trend: (m) => (m <= 2 ? 1.3 : 1),
      payDays: (_age, r) => between(r, 80, 94), partialProb: 0.04, returnRate: 0.008, targetUtilisation: 0.58,
      products: [...CORE, "P020", "P028", "P038"],
    },
  },
  {
    id: 7, code: "DS-007", name: "Al-Hayat Medical Store", nameAr: "مذخر الحياة الطبي", territoryId: 5, city: "Najaf",
    address: "Al-Kufa Road", contactPerson: "Haider Mahdi", phone: "+964 781 500 0007", rep: "repZainab", manager: "salesManager",
    scenario: "Sudden sales spike last month",
    profile: {
      invoicesPerMonth: 3, qtyScale: 0.8, trend: (m) => (m === 1 ? 3.2 : 1),
      payDays: (_age, r) => between(r, 82, 96), partialProb: 0.05, returnRate: 0.007, targetUtilisation: 0.6,
      products: [...CORE, "P029", "P039"],
    },
  },
  {
    id: 8, code: "DS-008", name: "Kurdistan Medical Distribution", nameAr: "مذخر كردستان الطبي", territoryId: 3, city: "Sulaymaniyah",
    address: "Salim St.", contactPerson: "Rebin Omer", phone: "+964 750 300 0008", rep: "repOmar", manager: "salesManager",
    scenario: "Collection deterioration: recent invoices unpaid past due",
    profile: {
      invoicesPerMonth: 4, qtyScale: 1.0, trend: () => 1,
      payDays: (age, r) => (age > 150 ? between(r, 76, 88) : null), partialProb: 0.02, returnRate: 0.006, targetUtilisation: 0.86,
      products: [...CORE, "P016", "P026", "P040"],
    },
  },
  {
    id: 9, code: "DS-009", name: "Al-Furat Drugstore", nameAr: "مذخر الفرات", territoryId: 5, city: "Karbala",
    address: "Al-Abbas St.", contactPerson: "Sadiq Jawad", phone: "+964 781 500 0009", rep: "repZainab", manager: "salesManager",
    scenario: "Healthy small account",
    profile: {
      invoicesPerMonth: 2, qtyScale: 0.6, trend: () => 1,
      payDays: (_age, r) => between(r, 70, 86), partialProb: 0.02, returnRate: 0.005, targetUtilisation: 0.42,
      products: CORE,
    },
  },
  {
    id: 10, code: "DS-010", name: "Tigris Medical Store", nameAr: "مذخر دجلة الطبي", territoryId: 1, city: "Baghdad",
    address: "Al-Adhamiya", contactPerson: "Waleed Kamal", phone: "+964 770 100 0010", rep: "repAli", manager: "areaBaghdad",
    scenario: "Possible expiry exposure: large short-dated purchase, no reorder; one disputed invoice",
    profile: {
      invoicesPerMonth: 3, qtyScale: 1.0, trend: () => 1,
      payDays: (_age, r) => between(r, 86, 99), partialProb: 0.05, returnRate: 0.015, targetUtilisation: 0.7,
      products: [...CORE, "P007", "P012", "P032"],
    },
  },
];

export type DemoProduct = {
  code: string;
  name: string;
  nameAr: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  therapeuticArea: string;
  packSize: string;
  listPrice: number;
  baseQty: number;
  isStrategic: boolean;
};

const p = (
  code: string, name: string, nameAr: string, genericName: string, strength: string, dosageForm: string,
  therapeuticArea: string, packSize: string, listPrice: number, baseQty: number, isStrategic = false,
): DemoProduct => ({ code, name, nameAr, genericName, strength, dosageForm, therapeuticArea, packSize, listPrice, baseQty, isStrategic });

export const PRODUCTS: DemoProduct[] = [
  p("P001", "Glucotrin 500 mg", "غلوكوترين 500 ملغ", "Metformin", "500 mg", "Tablet", "Diabetes", "30 tablets", 6500, 300, true),
  p("P002", "Amlovan 5 mg", "أملوفان 5 ملغ", "Amlodipine", "5 mg", "Tablet", "Cardiovascular", "30 tablets", 7500, 220, true),
  p("P003", "Atorgen 20 mg", "أتورجين 20 ملغ", "Atorvastatin", "20 mg", "Tablet", "Cardiovascular", "30 tablets", 12000, 160, true),
  p("P004", "Omezol 20 mg", "أوميزول 20 ملغ", "Omeprazole", "20 mg", "Capsule", "Gastroenterology", "14 capsules", 5500, 240),
  p("P005", "Amoxiclav 1 g", "أموكسيكلاف 1 غ", "Amoxicillin/Clavulanate", "875/125 mg", "Tablet", "Anti-infectives", "14 tablets", 9500, 180),
  p("P006", "Azitro 500 mg", "أزيترو 500 ملغ", "Azithromycin", "500 mg", "Tablet", "Anti-infectives", "3 tablets", 6000, 150),
  p("P007", "Glimetra 1 mg", "غليميترا 1 ملغ", "Glimepiride", "1 mg", "Tablet", "Diabetes", "30 tablets", 8500, 200),
  p("P008", "Sitaglen 100 mg", "سيتاغلين 100 ملغ", "Sitagliptin", "100 mg", "Tablet", "Diabetes", "28 tablets", 32000, 60, true),
  p("P009", "Insumix Pen", "إنسوميكس قلم", "Insulin aspart 30/70", "100 IU/ml", "Pen", "Diabetes", "5 pens", 45000, 40),
  p("P010", "Rosuvan 10 mg", "روزوفان 10 ملغ", "Rosuvastatin", "10 mg", "Tablet", "Cardiovascular", "28 tablets", 14000, 150, true),
  p("P011", "Valsar 80 mg", "فالسار 80 ملغ", "Valsartan", "80 mg", "Tablet", "Cardiovascular", "28 tablets", 11000, 140),
  p("P012", "Bisocard 5 mg", "بيسوكارد 5 ملغ", "Bisoprolol", "5 mg", "Tablet", "Cardiovascular", "30 tablets", 8000, 150),
  p("P013", "Clopidex 75 mg", "كلوبيدكس 75 ملغ", "Clopidogrel", "75 mg", "Tablet", "Cardiovascular", "28 tablets", 13500, 110),
  p("P014", "Osteval 70 mg", "أوستيفال 70 ملغ", "Alendronate", "70 mg", "Tablet", "Musculoskeletal", "4 tablets", 9000, 90),
  p("P015", "Diclofen 75 mg", "ديكلوفين 75 ملغ", "Diclofenac", "75 mg", "Injection", "Pain & inflammation", "5 ampoules", 4500, 200),
  p("P016", "Paramol Plus", "بارامول بلس", "Paracetamol/Caffeine", "500/65 mg", "Tablet", "Pain & inflammation", "24 tablets", 3000, 400),
  p("P017", "Ibuflex 400 mg", "إيبوفلكس 400 ملغ", "Ibuprofen", "400 mg", "Tablet", "Pain & inflammation", "20 tablets", 3500, 300),
  p("P018", "Montelar 10 mg", "مونتيلار 10 ملغ", "Montelukast", "10 mg", "Tablet", "Respiratory", "28 tablets", 15000, 90),
  p("P019", "Salbuvent Inhaler", "سالبوفنت بخاخ", "Salbutamol", "100 mcg", "Inhaler", "Respiratory", "200 doses", 7000, 120),
  p("P020", "Gastrozol 40 mg", "غاستروزول 40 ملغ", "Esomeprazole", "40 mg", "Tablet", "Gastroenterology", "14 tablets", 10500, 170, true),
  p("P021", "Levocet 5 mg", "ليفوسيت 5 ملغ", "Levocetirizine", "5 mg", "Tablet", "Allergy", "20 tablets", 4000, 220),
  p("P022", "Ceftrix 1 g", "سيفتركس 1 غ", "Ceftriaxone", "1 g", "Vial", "Anti-infectives", "1 vial", 3500, 300),
  p("P023", "Levoflox 500 mg", "ليفوفلوكس 500 ملغ", "Levofloxacin", "500 mg", "Tablet", "Anti-infectives", "7 tablets", 8500, 120),
  p("P024", "Ferrovit", "فيروفيت", "Ferrous fumarate/Folic acid", "305/0.35 mg", "Capsule", "Women's health", "30 capsules", 5000, 160),
  p("P025", "Calcivit D3", "كالسيفيت د3", "Calcium/Vitamin D3", "600 mg/400 IU", "Tablet", "Women's health", "30 tablets", 6000, 160),
  p("P026", "Thyrox 50 mcg", "ثايروكس 50 مكغ", "Levothyroxine", "50 mcg", "Tablet", "Endocrinology", "50 tablets", 5500, 130),
  p("P027", "Sertral 50 mg", "سيرترال 50 ملغ", "Sertraline", "50 mg", "Tablet", "CNS", "30 tablets", 12500, 70),
  p("P028", "Pregaba 75 mg", "بريغابا 75 ملغ", "Pregabalin", "75 mg", "Capsule", "CNS", "28 capsules", 16000, 80),
  p("P029", "Tamsul 0.4 mg", "تامسول 0.4 ملغ", "Tamsulosin", "0.4 mg", "Capsule", "Urology", "30 capsules", 13000, 70),
  p("P030", "Vitamax B12", "فيتاماكس ب12", "Cyanocobalamin", "1000 mcg", "Injection", "Vitamins", "3 ampoules", 4000, 220),
  p("P031", "Enoxa 40 mg", "إينوكسا 40 ملغ", "Enoxaparin", "40 mg", "Prefilled syringe", "Haematology", "2 syringes", 18000, 60),
  p("P032", "Rivaxa 20 mg", "ريفاكسا 20 ملغ", "Rivaroxaban", "20 mg", "Tablet", "Haematology", "28 tablets", 38000, 40, true),
  p("P033", "Dermacort Cream", "ديرماكورت كريم", "Hydrocortisone", "1%", "Cream", "Dermatology", "30 g", 3500, 150),
  p("P034", "Fluconix 150 mg", "فلوكونكس 150 ملغ", "Fluconazole", "150 mg", "Capsule", "Anti-infectives", "1 capsule", 2500, 200),
  p("P035", "Ondaset 8 mg", "أونداسيت 8 ملغ", "Ondansetron", "8 mg", "Tablet", "Gastroenterology", "10 tablets", 7000, 90),
  p("P036", "Losarex 50 mg", "لوساريكس 50 ملغ", "Losartan", "50 mg", "Tablet", "Cardiovascular", "30 tablets", 7000, 150),
  p("P037", "Spirolac 25 mg", "سبيرولاك 25 ملغ", "Spironolactone", "25 mg", "Tablet", "Cardiovascular", "20 tablets", 4500, 90),
  p("P038", "Cetaflu Syrup", "سيتافلو شراب", "Paracetamol (paediatric)", "120 mg/5 ml", "Syrup", "Paediatrics", "100 ml", 2500, 250),
  p("P039", "Zinkid Syrup", "زنكيد شراب", "Zinc sulfate", "20 mg/5 ml", "Syrup", "Paediatrics", "100 ml", 3000, 160),
  p("P040", "Hepasil 140 mg", "هيباسيل 140 ملغ", "Silymarin", "140 mg", "Capsule", "Gastroenterology", "30 capsules", 9000, 70),
];

export const PHARMACIES = [
  { id: 1, name: "Al-Amal Pharmacy", nameAr: "صيدلية الأمل", territoryId: 1, city: "Baghdad", area: "Karrada" },
  { id: 2, name: "Al-Rahma Pharmacy", nameAr: "صيدلية الرحمة", territoryId: 1, city: "Baghdad", area: "Al-Mansour" },
  { id: 3, name: "Baghdad Central Pharmacy", nameAr: "صيدلية بغداد المركزية", territoryId: 1, city: "Baghdad", area: "Bab Al-Muadham" },
  { id: 4, name: "Al-Zahraa Pharmacy", nameAr: "صيدلية الزهراء", territoryId: 1, city: "Baghdad", area: "Al-Adhamiya" },
  { id: 5, name: "Shatt Al-Arab Pharmacy", nameAr: "صيدلية شط العرب", territoryId: 2, city: "Basra", area: "Al-Ashar" },
  { id: 6, name: "Al-Basra Family Pharmacy", nameAr: "صيدلية العائلة", territoryId: 2, city: "Basra", area: "Al-Jazair" },
  { id: 7, name: "Erbil Health Pharmacy", nameAr: "صيدلية أربيل الصحية", territoryId: 3, city: "Erbil", area: "Ankawa" },
  { id: 8, name: "Slemani Care Pharmacy", nameAr: "صيدلية السليمانية", territoryId: 3, city: "Sulaymaniyah", area: "Salim" },
  { id: 9, name: "Nineveh Pharmacy", nameAr: "صيدلية نينوى", territoryId: 4, city: "Mosul", area: "Al-Zuhoor" },
  { id: 10, name: "Al-Kafeel Pharmacy", nameAr: "صيدلية الكفيل", territoryId: 5, city: "Karbala", area: "Centre" },
  { id: 11, name: "Al-Ghadeer Pharmacy", nameAr: "صيدلية الغدير", territoryId: 5, city: "Najaf", area: "Centre" },
  { id: 12, name: "Babylon Pharmacy", nameAr: "صيدلية بابل", territoryId: 5, city: "Hillah", area: "Centre" },
];

export const COMPETITORS = [
  { id: 1, name: "Competitor Alpha (regional generics)", notes: "Fictional demo competitor" },
  { id: 2, name: "Competitor Beta (multinational)", notes: "Fictional demo competitor" },
  { id: 3, name: "Competitor Gamma (local manufacturer)", notes: "Fictional demo competitor" },
  { id: 4, name: "Competitor Delta (importer)", notes: "Fictional demo competitor" },
];
