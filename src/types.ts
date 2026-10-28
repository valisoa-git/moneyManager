export const CATEGORIES = [
  { id: "alimentation", label: "Alimentation", color: "#7dcea0" },
  { id: "transport", label: "Transport", color: "#5dade2" },
  { id: "logement", label: "Logement", color: "#f5b041" },
  { id: "sante", label: "Santé", color: "#ec7063" },
  { id: "loisirs", label: "Loisirs", color: "#af7ac5" },
  { id: "abonnements", label: "Abonnements", color: "#48c9b0" },
  { id: "autre", label: "Autre", color: "#85929e" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type Expense = {
  id: string;
  amount: number;
  category: CategoryId;
  note: string;
  date: string;
};

export type Staff = {
  id: string;
  name: string;
  salary: number;
};

export type PersonalExpense = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

export type BucketProject = {
  id: string;
  title: string;
  amount: number;
  year: number;
  plannedMonth?: string;
  done: boolean;
};

export type FixedChargeItem = {
  id: string;
  label: string;
  amount: number;
  subItems?: FixedChargeItem[];
};

export type DayFraction = 0.5 | 1;

export type DayEntry = {
  id: string;
  date: string;
  fraction: DayFraction;
  note: string;
};

export const THEMES = [
  { id: "noir", label: "Noir" },
  { id: "clair", label: "Blanc" },
  { id: "violet", label: "Violet" },
  { id: "rose", label: "Rose" },
  { id: "rouge", label: "Rouge" },
  { id: "fleur", label: "Fleur" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export type Settings = {
  tjm: number;
  husbandTjm: number;
  fixedCharges: number;
  fixedChargeItems: FixedChargeItem[];
  defaultVariableChargeBudget: number;
  defaultProjectBudget: number;
  roundingStep: 500_000 | 1_000_000;
  theme: ThemeId;
};

export type MonthWork = {
  leaves: DayEntry[];
  extras: DayEntry[];
  husbandLeaves: DayEntry[];
  husbandExtras: DayEntry[];
  husbandScheduleCustom: boolean;
  variableChargeBudget: number;
  variableCharges: FixedChargeItem[];
  projectBudget: number;
};

export type Store = {
  expenses: Expense[];
  personalExpenses: PersonalExpense[];
  projects: BucketProject[];
  projectSeedVersion: number;
  settings: Settings;
  staff: Staff[];
  months: Record<string, MonthWork>;
};

export const TJM = 315_000;
export const EXPENSE_TOTALS_START_MONTH = "2026-09";
export const LONG_TERM_EXPENSES_START_MONTH = "2027-01";
export const ROUND_TO_HUNDRED_START_MONTH = "2027-09";
export const PRE_SEPTEMBER_FIXED_CHARGES = 1_200_000;
export const PRE_SEPTEMBER_VARIABLE_CHARGE_BUDGET = 1_200_000;
export const DEFAULT_FIXED_CHARGE_ITEMS: FixedChargeItem[] = [
  {
    id: "logement",
    label: "Logement",
    amount: 280_000,
    subItems: [
      { id: "jirama", label: "Jirama", amount: 200_000 },
      { id: "mpanampy", label: "Mpanampy", amount: 80_000 },
    ],
  },
  {
    id: "sakafo",
    label: "Sakafo",
    amount: 690_000,
    subItems: [
      { id: "laoka", label: "Laoka", amount: 500_000 },
      { id: "fruit", label: "Fruit", amount: 60_000 },
      { id: "atody", label: "Atody", amount: 30_000 },
      { id: "mofo", label: "Mofo", amount: 25_000 },
      { id: "rano", label: "Rano", amount: 75_000 },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    amount: 300_000,
    subItems: [{ id: "carburant", label: "Carburant", amount: 300_000 }],
  },
  {
    id: "sante",
    label: "Santé",
    amount: 50_000,
    subItems: [
      { id: "vaccin", label: "Vaccin", amount: 10_000 },
      { id: "pediatre", label: "Pédiatre", amount: 40_000 },
    ],
  },
  {
    id: "internet",
    label: "Internet",
    amount: 310_000,
    subItems: [
      { id: "starlink", label: "Starlink", amount: 140_000 },
      { id: "connexion-67", label: "Connexion 67", amount: 110_000 },
      { id: "backup", label: "Backup", amount: 60_000 },
    ],
  },
  {
    id: "provision",
    label: "Provision",
    amount: 450_000,
    subItems: [
      { id: "grossiste", label: "Grossiste", amount: 220_000 },
      { id: "kibo", label: "Kibo", amount: 230_000 },
    ],
  },
  {
    id: "depense-commune",
    label: "Dépense commune",
    amount: 1_300_000,
    subItems: [
      { id: "mama", label: "Mama", amount: 400_000 },
      { id: "maman-auri", label: "Maman Auri", amount: 400_000 },
      { id: "hery", label: "Hery", amount: 250_000 },
      { id: "nou", label: "Nou", amount: 250_000 },
    ],
  },
];
export const DEFAULT_FIXED_CHARGES = DEFAULT_FIXED_CHARGE_ITEMS.reduce((sum, item) => sum + item.amount, 0);
export const DEFAULT_VARIABLE_CHARGE_ITEMS: FixedChargeItem[] = [
  {
    id: "enfants",
    label: "Enfants",
    amount: 260_000,
    subItems: [
      { id: "couche", label: "Couche", amount: 140_000 },
      { id: "lingette", label: "Lingette", amount: 15_000 },
      { id: "lait", label: "Lait", amount: 105_000 },
    ],
  },
  {
    id: "shopping",
    label: "Shopping",
    amount: 120_000,
    subItems: [
      { id: "ariel-bebe", label: "Ariel bébé", amount: 100_000 },
      { id: "aina", label: "Aina", amount: 20_000 },
    ],
  },
  {
    id: "autre",
    label: "Autre",
    amount: 260_000,
    subItems: [
      { id: "imprevu", label: "Imprévu", amount: 120_000 },
      { id: "gaz-riz", label: "Gaz ou riz", amount: 120_000 },
      { id: "mvola", label: "Mvola", amount: 20_000 },
    ],
  },
  {
    id: "loisirs",
    label: "Loisirs",
    amount: 150_000,
    subItems: [
      { id: "gouter", label: "Goûter", amount: 50_000 },
      { id: "resto", label: "Resto", amount: 100_000 },
    ],
  },
  {
    id: "adidy",
    label: "Adidy",
    amount: 130_000,
    subItems: [
      { id: "fiangonana", label: "Fiangonana", amount: 50_000 },
      { id: "rakitraitra", label: "Rakitraitra", amount: 20_000 },
      { id: "fokotany", label: "Fokotany", amount: 10_000 },
      { id: "parent", label: "Parent", amount: 50_000 },
    ],
  },
];
export const DEFAULT_VARIABLE_CHARGE_BUDGET = DEFAULT_VARIABLE_CHARGE_ITEMS.reduce((sum, item) => sum + item.amount, 0);
export const DEFAULT_LONG_TERM_EXPENSE_ITEMS: FixedChargeItem[] = [
  { id: "retraite", label: "Retraite", amount: 500_000 },
  { id: "universite-bebe", label: "Épargne université bébé", amount: 500_000 },
  { id: "vacances-etranger", label: "Vacances étranger", amount: 700_000 },
  { id: "vacances-locales", label: "Vacances locales", amount: 200_000 },
  { id: "assurance-sante", label: "Assurance santé", amount: 100_000 },
];
export const DEFAULT_LONG_TERM_EXPENSE_TOTAL = DEFAULT_LONG_TERM_EXPENSE_ITEMS.reduce((sum, item) => sum + item.amount, 0);
export const DEFAULT_PROJECT_BUDGET = 500_000;

export const DEFAULT_SETTINGS: Settings = {
  tjm: TJM,
  husbandTjm: TJM,
  fixedCharges: DEFAULT_FIXED_CHARGES,
  fixedChargeItems: DEFAULT_FIXED_CHARGE_ITEMS,
  defaultVariableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
  defaultProjectBudget: DEFAULT_PROJECT_BUDGET,
  roundingStep: 500_000,
  theme: "noir",
};

export const EMPTY_MONTH: MonthWork = {
  leaves: [],
  extras: [],
  husbandLeaves: [],
  husbandExtras: [],
  husbandScheduleCustom: false,
  variableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
  variableCharges: DEFAULT_VARIABLE_CHARGE_ITEMS,
  projectBudget: DEFAULT_PROJECT_BUDGET,
};

export function categoryOf(id: CategoryId) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function monthKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function shiftMonth(key: string, delta: number) {
  const d = parseMonthKey(key);
  d.setMonth(d.getMonth() + delta);
  return monthKey(d);
}

export function formatMonth(key: string) {
  return parseMonthKey(key).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export function formatMoney(amount: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(amount / 1_000)} kAr`;
}

export function formatAmountInput(amount: number) {
  return String(amount / 1_000).replace(".", ",");
}

export function formatDays(n: number) {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}

export function fractionLabel(fraction: DayFraction) {
  return fraction === 0.5 ? "Demi-journée" : "Journée";
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const amount = Number(trimmed.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount * 1_000 : NaN;
}

export function parseFraction(value: string): DayFraction {
  return value === "0.5" ? 0.5 : 1;
}
