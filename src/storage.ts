import {
  DEFAULT_FIXED_CHARGES,
  DEFAULT_FIXED_CHARGE_ITEMS,
  DEFAULT_SETTINGS,
  DEFAULT_VARIABLE_CHARGE_BUDGET,
  DEFAULT_VARIABLE_CHARGE_ITEMS,
  EMPTY_MONTH,
  THEMES,
  TJM,
  type DayEntry,
  type DayFraction,
  type Expense,
  type FixedChargeItem,
  type MonthWork,
  type PersonalExpense,
  type Settings,
  type Store,
  type ThemeId,
} from "./types";

const KEY = "gestion-depenses:v4";
const LEGACY_V3 = "gestion-depenses:v3";
const LEGACY_V2 = "gestion-depenses:v2";
const LEGACY_V1 = "gestion-depenses:v1";

const empty: Store = {
  expenses: [],
  personalExpenses: [],
  settings: DEFAULT_SETTINGS,
  staff: [],
  months: {},
};

function isExpenseArray(value: unknown): value is Expense[] {
  return Array.isArray(value);
}

function isPersonalExpenseArray(value: unknown): value is PersonalExpense[] {
  return Array.isArray(value);
}

function migrateTheme(value: unknown): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : DEFAULT_SETTINGS.theme;
}

function migrateFixedChargeItems(raw: unknown): FixedChargeItem[] {
  if (!Array.isArray(raw)) return DEFAULT_FIXED_CHARGE_ITEMS;
  return raw
    .map((item) => item as Partial<FixedChargeItem>)
    .filter((item) => item.id && item.label && typeof item.amount === "number" && item.amount >= 0)
    .map((item) => ({
      id: String(item.id),
      label: String(item.label),
      amount: item.amount ?? 0,
    }));
}

function migrateChargeItems(raw: unknown, defaults: FixedChargeItem[]): FixedChargeItem[] {
  if (!Array.isArray(raw)) return defaults;
  return raw
    .map((item) => item as Partial<FixedChargeItem>)
    .filter((item) => item.id && item.label && typeof item.amount === "number" && item.amount >= 0)
    .map((item) => ({
      id: String(item.id),
      label: String(item.label),
      amount: item.amount ?? 0,
    }));
}

function asFraction(value: unknown): DayFraction {
  return value === 0.5 || value === "0.5" ? 0.5 : 1;
}

function fromHours(hours: number): DayFraction {
  return hours > 0 && hours < 8 ? 0.5 : 1;
}

function migrateLeaves(raw: unknown): DayEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { id: crypto.randomUUID(), date: item, fraction: 1 as const, note: "" };
    }
    const entry = item as Partial<DayEntry> & { hours?: number };
    return {
      id: entry.id ?? crypto.randomUUID(),
      date: entry.date ?? "",
      fraction: asFraction(entry.fraction ?? (entry.hours != null ? fromHours(entry.hours) : 1)),
      note: entry.note ?? "",
    };
  }).filter((item) => item.date);
}

function migrateExtras(raw: unknown): DayEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const entry = item as Partial<DayEntry> & { hours?: number };
    return {
      id: entry.id ?? crypto.randomUUID(),
      date: entry.date ?? "",
      fraction: asFraction(entry.fraction ?? (entry.hours != null ? fromHours(entry.hours) : 1)),
      note: entry.note ?? "",
    };
  }).filter((item) => item.date);
}

function migrateMonth(raw: unknown, defaultVariableChargeBudget: number): MonthWork {
  if (!raw || typeof raw !== "object") return { ...EMPTY_MONTH, variableChargeBudget: defaultVariableChargeBudget };
  const month = raw as {
    leaves?: unknown;
    extras?: unknown;
    overtimes?: unknown;
    husbandLeaves?: unknown;
    husbandExtras?: unknown;
    husbandOvertimes?: unknown;
    husbandScheduleCustom?: unknown;
    variableChargeBudget?: unknown;
    variableCharges?: unknown;
  };
  return {
    leaves: migrateLeaves(month.leaves),
    extras: migrateExtras(month.extras ?? month.overtimes),
    husbandLeaves: migrateLeaves(month.husbandLeaves),
    husbandExtras: migrateExtras(month.husbandExtras ?? month.husbandOvertimes),
    husbandScheduleCustom: month.husbandScheduleCustom === true,
    variableChargeBudget:
      typeof month.variableChargeBudget === "number" && month.variableChargeBudget >= 0
        ? month.variableChargeBudget
        : defaultVariableChargeBudget,
    variableCharges: migrateChargeItems(month.variableCharges, DEFAULT_VARIABLE_CHARGE_ITEMS),
  };
}

function addLegacyExpensesToMonths(months: Store["months"], expenses: Expense[], defaultVariableChargeBudget: number) {
  for (const expense of expenses) {
    const key = expense.date.slice(0, 7);
    if (!key) continue;
    const month = months[key] ?? { ...EMPTY_MONTH, variableChargeBudget: defaultVariableChargeBudget };
    const alreadyExists = month.variableCharges.some((item) => item.id === expense.id);
    months[key] = {
      ...month,
      variableCharges: alreadyExists
        ? month.variableCharges
        : [
            ...month.variableCharges,
            {
              id: expense.id,
              label: expense.note || "Charge variable",
              amount: expense.amount,
            },
          ],
    };
  }
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store> & { months?: Record<string, unknown> };
      const settings: Settings = {
        tjm: parsed.settings?.tjm && parsed.settings.tjm > 0 ? parsed.settings.tjm : TJM,
        husbandTjm:
          parsed.settings?.husbandTjm && parsed.settings.husbandTjm > 0
            ? parsed.settings.husbandTjm
            : DEFAULT_SETTINGS.husbandTjm,
        fixedCharges:
          typeof parsed.settings?.fixedCharges === "number" && parsed.settings.fixedCharges >= 0
            ? parsed.settings.fixedCharges
            : DEFAULT_SETTINGS.fixedCharges,
        fixedChargeItems: migrateFixedChargeItems(parsed.settings?.fixedChargeItems),
        defaultVariableChargeBudget:
          typeof parsed.settings?.defaultVariableChargeBudget === "number" &&
          parsed.settings.defaultVariableChargeBudget >= 0
            ? parsed.settings.defaultVariableChargeBudget
            : DEFAULT_VARIABLE_CHARGE_BUDGET,
        roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
        theme: migrateTheme(parsed.settings?.theme),
      };
      const months: Store["months"] = {};
      for (const [key, value] of Object.entries(parsed.months ?? {})) {
        months[key] = migrateMonth(value, settings.defaultVariableChargeBudget);
      }
      addLegacyExpensesToMonths(months, parsed.expenses ?? [], settings.defaultVariableChargeBudget);
      return {
        expenses: [],
        personalExpenses: isPersonalExpenseArray(parsed.personalExpenses) ? parsed.personalExpenses : [],
        settings,
        staff: parsed.staff ?? [],
        months,
      };
    }
    const legacyV3 = localStorage.getItem(LEGACY_V3);
    if (legacyV3) {
      const parsed = JSON.parse(legacyV3) as Partial<Store> & { months?: Record<string, unknown> };
      const settings: Settings = {
        tjm: parsed.settings?.tjm && parsed.settings.tjm > 0 ? parsed.settings.tjm : TJM,
        husbandTjm:
          parsed.settings?.husbandTjm && parsed.settings.husbandTjm > 0
            ? parsed.settings.husbandTjm
            : DEFAULT_SETTINGS.husbandTjm,
        fixedCharges:
          typeof parsed.settings?.fixedCharges === "number" && parsed.settings.fixedCharges >= 0
            ? parsed.settings.fixedCharges
            : DEFAULT_SETTINGS.fixedCharges,
        fixedChargeItems: migrateFixedChargeItems(parsed.settings?.fixedChargeItems),
        defaultVariableChargeBudget:
          typeof parsed.settings?.defaultVariableChargeBudget === "number" &&
          parsed.settings.defaultVariableChargeBudget >= 0
            ? parsed.settings.defaultVariableChargeBudget
            : DEFAULT_VARIABLE_CHARGE_BUDGET,
        roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
        theme: migrateTheme(parsed.settings?.theme),
      };
      const months: Store["months"] = {};
      for (const [key, value] of Object.entries(parsed.months ?? {})) {
        months[key] = migrateMonth(value, settings.defaultVariableChargeBudget);
      }
      addLegacyExpensesToMonths(months, parsed.expenses ?? [], settings.defaultVariableChargeBudget);
      return {
        expenses: [],
        personalExpenses: isPersonalExpenseArray(parsed.personalExpenses) ? parsed.personalExpenses : [],
        settings,
        staff: parsed.staff ?? [],
        months,
      };
    }
    const legacyV2 = localStorage.getItem(LEGACY_V2);
    if (legacyV2) {
      const parsed = JSON.parse(legacyV2) as Partial<Store> & { months?: Record<string, unknown> };
      const settings: Settings = {
        tjm: parsed.settings?.tjm && parsed.settings.tjm > 0 ? parsed.settings.tjm : TJM,
        husbandTjm: DEFAULT_SETTINGS.husbandTjm,
        fixedCharges: DEFAULT_FIXED_CHARGES,
        fixedChargeItems: DEFAULT_FIXED_CHARGE_ITEMS,
        defaultVariableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
        roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
        theme: migrateTheme(parsed.settings?.theme),
      };
      const months: Store["months"] = {};
      for (const [key, value] of Object.entries(parsed.months ?? {})) {
        months[key] = migrateMonth(value, settings.defaultVariableChargeBudget);
      }
      addLegacyExpensesToMonths(months, parsed.expenses ?? [], settings.defaultVariableChargeBudget);
      return {
        expenses: [],
        personalExpenses: isPersonalExpenseArray(parsed.personalExpenses) ? parsed.personalExpenses : [],
        settings,
        staff: parsed.staff ?? [],
        months,
      };
    }
    const legacyV1 = localStorage.getItem(LEGACY_V1);
    if (legacyV1) {
      const parsed = JSON.parse(legacyV1) as unknown;
      if (isExpenseArray(parsed)) {
        const months: Store["months"] = {};
        addLegacyExpensesToMonths(months, parsed, DEFAULT_VARIABLE_CHARGE_BUDGET);
        return { ...empty, months };
      }
    }
  } catch {
    return empty;
  }
  return empty;
}

export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function monthWork(store: Store, key: string) {
  return (
    store.months[key] ?? {
      ...EMPTY_MONTH,
      variableChargeBudget: store.settings.defaultVariableChargeBudget,
      variableCharges: DEFAULT_VARIABLE_CHARGE_ITEMS,
    }
  );
}
