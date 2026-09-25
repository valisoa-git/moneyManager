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
};

export type DayFraction = 0.5 | 1;

export type DayEntry = {
  id: string;
  date: string;
  fraction: DayFraction;
  note: string;
};

export const THEMES = [
  { id: "chocolat", label: "Chocolat moutarde" },
  { id: "foret", label: "Forêt dorée" },
  { id: "ocean", label: "Océan corail" },
  { id: "prune", label: "Prune miel" },
  { id: "graphite", label: "Graphite citron" },
  { id: "rose", label: "Rose cacao" },
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
export const DEFAULT_FIXED_CHARGE_ITEMS: FixedChargeItem[] = [
  { id: "provision", label: "Provision", amount: 300_000 },
  { id: "essence", label: "Essence", amount: 300_000 },
  { id: "panampy", label: "Panampy", amount: 100_000 },
  { id: "mama-auri", label: "Mama auri", amount: 400_000 },
  { id: "mama-valisoa", label: "Mama valisoa", amount: 400_000 },
  { id: "starlink", label: "Starlink", amount: 140_000 },
  { id: "connexion-67", label: "Connexion 67", amount: 110_000 },
  { id: "jirama", label: "Jirama", amount: 150_000 },
  { id: "sakafo", label: "Sakafo", amount: 600_000 },
  { id: "hery", label: "Hery", amount: 250_000 },
  { id: "noella", label: "Noella (connexion + hofatrano)", amount: 250_000 },
];
export const DEFAULT_FIXED_CHARGES = DEFAULT_FIXED_CHARGE_ITEMS.reduce((sum, item) => sum + item.amount, 0);
export const DEFAULT_VARIABLE_CHARGE_ITEMS: FixedChargeItem[] = [
  { id: "couche", label: "Couche", amount: 400_000 },
  { id: "panampy-2", label: "Panampy 2", amount: 80_000 },
  { id: "bonbone-eau", label: "Bonbone à eau", amount: 104_000 },
  { id: "gouter", label: "Goûter", amount: 100_000 },
  { id: "imprevu", label: "Imprévu", amount: 100_000 },
  { id: "mvola", label: "Mvola", amount: 15_000 },
  { id: "clinique-noa", label: "Clinique Noa", amount: 100_000 },
  { id: "adidy", label: "Adidy", amount: 100_000 },
];
export const DEFAULT_VARIABLE_CHARGE_BUDGET = 1_000_000;
export const DEFAULT_PROJECT_BUDGET = 1_000_000;

export const DEFAULT_SETTINGS: Settings = {
  tjm: TJM,
  husbandTjm: TJM,
  fixedCharges: DEFAULT_FIXED_CHARGES,
  fixedChargeItems: DEFAULT_FIXED_CHARGE_ITEMS,
  defaultVariableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
  defaultProjectBudget: DEFAULT_PROJECT_BUDGET,
  roundingStep: 500_000,
  theme: "chocolat",
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
