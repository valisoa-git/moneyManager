import {
  DEFAULT_FIXED_CHARGES,
  DEFAULT_FIXED_CHARGE_ITEMS,
  DEFAULT_PROJECT_BUDGET,
  DEFAULT_SETTINGS,
  DEFAULT_VARIABLE_CHARGE_BUDGET,
  DEFAULT_VARIABLE_CHARGE_ITEMS,
  EMPTY_MONTH,
  EXPENSE_TOTALS_START_MONTH,
  PRE_SEPTEMBER_VARIABLE_CHARGE_BUDGET,
  THEMES,
  TJM,
  type BucketProject,
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

const KEY = "gestion-depenses:v6";
const LEGACY_V5 = "gestion-depenses:v5";
const LEGACY_V4 = "gestion-depenses:v4";
const LEGACY_V3 = "gestion-depenses:v3";
const LEGACY_V2 = "gestion-depenses:v2";
const LEGACY_V1 = "gestion-depenses:v1";
export const PROJECT_SEED_VERSION = 1;
const LEGACY_DEFAULT_VARIABLE_CHARGE_BUDGETS = new Set([1_000_000, 1_200_000]);
const LEGACY_DEFAULT_PROJECT_BUDGETS = new Set([1_000_000]);
const DEFAULT_2027_HOLIDAY_LEAVES: Record<string, { date: string; note: string }> = {
  "2027-01": { date: "2027-01-01", note: "Férié - Nouvel an" },
  "2027-03": { date: "2027-03-08", note: "Férié - Journée des femmes" },
  "2027-05": { date: "2027-05-06", note: "Férié - Ascension" },
  "2027-11": { date: "2027-11-01", note: "Férié - Toussaint" },
};

const STARTER_PROJECTS: BucketProject[] = [
  {
    id: "starter-machine-a-laver-2026",
    title: "Machine à laver",
    amount: 1_300_000,
    year: 2026,
    plannedMonth: "2026-07",
    done: false,
  },
  {
    id: "starter-passeport-2026",
    title: "Passeport",
    amount: 1_300_000,
    year: 2026,
    plannedMonth: "2026-08",
    done: false,
  },
  {
    id: "starter-electromenager-2026",
    title: "Électroménager",
    amount: 1_000_000,
    year: 2026,
    plannedMonth: "2026-09",
    done: false,
  },
  {
    id: "starter-cadeau-noel-2026",
    title: "Cadeau de Noël",
    amount: 1_000_000,
    year: 2026,
    plannedMonth: "2026-10",
    done: false,
  },
  {
    id: "starter-table-a-manger-2026",
    title: "Table à manger",
    amount: 0,
    year: 2026,
    done: false,
  },
];

const empty: Store = {
  expenses: [],
  personalExpenses: [],
  projects: [],
  projectSeedVersion: 0,
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

function migrateProjects(raw: unknown): BucketProject[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item as Partial<BucketProject>)
    .filter((item) => item.id && item.title && typeof item.amount === "number" && item.amount >= 0)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title),
      amount: item.amount ?? 0,
      year: typeof item.year === "number" ? item.year : new Date().getFullYear(),
      plannedMonth: typeof item.plannedMonth === "string" && item.plannedMonth ? item.plannedMonth : undefined,
      done: item.done === true,
    }));
}

function projectKey(project: Pick<BucketProject, "title" | "year">) {
  return `${project.year}:${project.title.trim().toLocaleLowerCase("fr-FR")}`;
}

function mergeStarterProjects(projects: BucketProject[]) {
  const existing = new Set(projects.map(projectKey));
  const missing = STARTER_PROJECTS.filter((project) => !existing.has(projectKey(project)));
  return [...projects, ...missing];
}

export function withStarterProjects(store: Store): Store {
  if ((store.projectSeedVersion ?? 0) >= PROJECT_SEED_VERSION) return store;
  return {
    ...store,
    projects: mergeStarterProjects(store.projects),
    projectSeedVersion: PROJECT_SEED_VERSION,
  };
}

function migrateTheme(value: unknown): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : DEFAULT_SETTINGS.theme;
}

function migrateFixedChargeItems(_raw: unknown): FixedChargeItem[] {
  return DEFAULT_FIXED_CHARGE_ITEMS;
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
      subItems: migrateChargeItems(item.subItems, []),
    }));
}

function usesFixedExpenseTotals(key: string) {
  return key >= EXPENSE_TOTALS_START_MONTH;
}

function defaultVariableChargeBudgetForMonth(key: string) {
  return usesFixedExpenseTotals(key) ? DEFAULT_VARIABLE_CHARGE_BUDGET : PRE_SEPTEMBER_VARIABLE_CHARGE_BUDGET;
}

function defaultVariableChargeItemsForMonth(key: string) {
  return usesFixedExpenseTotals(key) ? DEFAULT_VARIABLE_CHARGE_ITEMS : [];
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function monthEndWeekday(key: string) {
  const [year, month] = key.split("-").map(Number);
  const cursor = new Date(year, month, 0);
  while (!isWeekday(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  return `${key}-${String(cursor.getDate()).padStart(2, "0")}`;
}

function nextWeekday(date: Date) {
  const cursor = new Date(date);
  while (!isWeekday(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

function monthlyLeaveDate(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = nextWeekday(new Date(year, month - 1, 23));
  return `${key}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDefault2027Leave(leave: DayEntry) {
  return leave.id.startsWith("default-leave-") || leave.note.startsWith("Férié - ") || leave.note === "Congé mensuel du 23" || leave.note === "Congé fin du mois";
}

function shouldRefreshDefaultLeaves(key: string, leaves: DayEntry[]) {
  return key.startsWith("2027-") && (leaves.length === 0 || leaves.every(isDefault2027Leave));
}

function defaultLeavesForMonth(key: string): DayEntry[] {
  if (!key.startsWith("2027-")) return [];

  const leaves: DayEntry[] = [];
  const holiday = DEFAULT_2027_HOLIDAY_LEAVES[key];
  if (holiday) {
    leaves.push({
      id: `default-leave-${holiday.date}`,
      date: holiday.date,
      fraction: 1,
      note: holiday.note,
    });
  } else {
    const endDate = monthEndWeekday(key);
    leaves.push({
      id: `default-leave-${endDate}`,
      date: endDate,
      fraction: 1,
      note: "Congé fin du mois",
    });
  }

  const date23 = monthlyLeaveDate(key);
  if (!leaves.some((leave) => leave.date === date23)) {
    leaves.push({
      id: `default-leave-${date23}`,
      date: date23,
      fraction: 1,
      note: date23.endsWith("-23") ? "Congé mensuel du 23" : "Congé mensuel du 23 reporté",
    });
  }

  return leaves;
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

function migrateMonth(key: string, raw: unknown, defaultProjectBudget: number): MonthWork {
  const defaultVariableChargeBudget = defaultVariableChargeBudgetForMonth(key);
  const defaultVariableCharges = defaultVariableChargeItemsForMonth(key);
  const defaultLeaves = defaultLeavesForMonth(key);
  if (!raw || typeof raw !== "object") {
    return {
      ...EMPTY_MONTH,
      leaves: defaultLeaves,
      variableChargeBudget: defaultVariableChargeBudget,
      variableCharges: defaultVariableCharges,
      projectBudget: defaultProjectBudget,
    };
  }
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
    projectBudget?: unknown;
  };
  const savedLeaves = Array.isArray(month.leaves) ? migrateLeaves(month.leaves) : [];
  const leaves = shouldRefreshDefaultLeaves(key, savedLeaves) ? defaultLeaves : savedLeaves;
  const variableChargeBudget =
    typeof month.variableChargeBudget === "number" && month.variableChargeBudget >= 0
      ? month.variableChargeBudget
      : defaultVariableChargeBudget;

  return {
    leaves,
    extras: migrateExtras(month.extras ?? month.overtimes),
    husbandLeaves: migrateLeaves(month.husbandLeaves),
    husbandExtras: migrateExtras(month.husbandExtras ?? month.husbandOvertimes),
    husbandScheduleCustom: month.husbandScheduleCustom === true,
    variableChargeBudget:
      usesFixedExpenseTotals(key) || LEGACY_DEFAULT_VARIABLE_CHARGE_BUDGETS.has(variableChargeBudget)
        ? defaultVariableChargeBudget
        : variableChargeBudget,
    variableCharges: usesFixedExpenseTotals(key)
      ? DEFAULT_VARIABLE_CHARGE_ITEMS
      : migrateChargeItems(month.variableCharges, defaultVariableCharges),
    projectBudget:
      typeof month.projectBudget === "number" && month.projectBudget >= 0
        ? LEGACY_DEFAULT_PROJECT_BUDGETS.has(month.projectBudget)
          ? defaultProjectBudget
          : month.projectBudget
        : defaultProjectBudget,
  };
}

function addLegacyExpensesToMonths(
  months: Store["months"],
  expenses: Expense[],
  defaultProjectBudget: number,
) {
  for (const expense of expenses) {
    const key = expense.date.slice(0, 7);
    if (!key) continue;
    if (usesFixedExpenseTotals(key)) continue;
    const month = months[key] ?? {
      ...EMPTY_MONTH,
      variableChargeBudget: defaultVariableChargeBudgetForMonth(key),
      variableCharges: defaultVariableChargeItemsForMonth(key),
      projectBudget: defaultProjectBudget,
    };
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

type RawStore = Partial<Store> & { months?: Record<string, unknown> };

function migrateSettings(parsed: RawStore, options: { legacyV2?: boolean } = {}): Settings {
  if (options.legacyV2) {
    return {
      tjm: parsed.settings?.tjm && parsed.settings.tjm > 0 ? parsed.settings.tjm : TJM,
      husbandTjm: DEFAULT_SETTINGS.husbandTjm,
      fixedCharges: DEFAULT_FIXED_CHARGES,
      fixedChargeItems: DEFAULT_FIXED_CHARGE_ITEMS,
      defaultVariableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
      defaultProjectBudget: DEFAULT_PROJECT_BUDGET,
      roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
      theme: migrateTheme(parsed.settings?.theme),
    };
  }

  return {
    tjm: parsed.settings?.tjm && parsed.settings.tjm > 0 ? parsed.settings.tjm : TJM,
    husbandTjm:
      parsed.settings?.husbandTjm && parsed.settings.husbandTjm > 0
        ? parsed.settings.husbandTjm
        : DEFAULT_SETTINGS.husbandTjm,
    fixedCharges: DEFAULT_FIXED_CHARGES,
    fixedChargeItems: migrateFixedChargeItems(parsed.settings?.fixedChargeItems),
    defaultVariableChargeBudget: DEFAULT_VARIABLE_CHARGE_BUDGET,
    defaultProjectBudget:
      typeof parsed.settings?.defaultProjectBudget === "number" && parsed.settings.defaultProjectBudget >= 0
        ? LEGACY_DEFAULT_PROJECT_BUDGETS.has(parsed.settings.defaultProjectBudget)
          ? DEFAULT_PROJECT_BUDGET
          : parsed.settings.defaultProjectBudget
        : DEFAULT_PROJECT_BUDGET,
    roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
    theme: migrateTheme(parsed.settings?.theme),
  };
}

function migrateStore(parsed: RawStore, options: { legacyV2?: boolean } = {}): Store {
  const settings = migrateSettings(parsed, options);
  const months: Store["months"] = {};
  for (const [key, value] of Object.entries(parsed.months ?? {})) {
    months[key] = migrateMonth(key, value, settings.defaultProjectBudget);
  }
  addLegacyExpensesToMonths(
    months,
    parsed.expenses ?? [],
    settings.defaultProjectBudget,
  );

  return withStarterProjects({
    expenses: [],
    personalExpenses: isPersonalExpenseArray(parsed.personalExpenses) ? parsed.personalExpenses : [],
    projects: migrateProjects(parsed.projects),
    projectSeedVersion: typeof parsed.projectSeedVersion === "number" ? parsed.projectSeedVersion : 0,
    settings,
    staff: parsed.staff ?? [],
    months,
  });
}

export function normalizeStore(raw: unknown): Store {
  if (!raw || typeof raw !== "object") return withStarterProjects(empty);
  return migrateStore(raw as RawStore);
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      return migrateStore(JSON.parse(raw) as RawStore);
    }
    const legacyV5 = localStorage.getItem(LEGACY_V5);
    if (legacyV5) {
      return migrateStore(JSON.parse(legacyV5) as RawStore);
    }
    const legacyV4 = localStorage.getItem(LEGACY_V4);
    if (legacyV4) {
      return migrateStore(JSON.parse(legacyV4) as RawStore);
    }
    const legacyV3 = localStorage.getItem(LEGACY_V3);
    if (legacyV3) {
      return migrateStore(JSON.parse(legacyV3) as RawStore);
    }
    const legacyV2 = localStorage.getItem(LEGACY_V2);
    if (legacyV2) {
      return migrateStore(JSON.parse(legacyV2) as RawStore, { legacyV2: true });
    }
    const legacyV1 = localStorage.getItem(LEGACY_V1);
    if (legacyV1) {
      const parsed = JSON.parse(legacyV1) as unknown;
      if (isExpenseArray(parsed)) {
        const months: Store["months"] = {};
        addLegacyExpensesToMonths(months, parsed, DEFAULT_PROJECT_BUDGET);
        return withStarterProjects({ ...empty, months });
      }
    }
  } catch {
    return withStarterProjects(empty);
  }
  return withStarterProjects(empty);
}

export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function monthWork(store: Store, key: string) {
  const defaultVariableChargeBudget = defaultVariableChargeBudgetForMonth(key);
  const defaultVariableCharges = defaultVariableChargeItemsForMonth(key);
  const defaultLeaves = defaultLeavesForMonth(key);
  const work =
    store.months[key] ?? {
      ...EMPTY_MONTH,
      leaves: defaultLeaves,
      projectBudget: store.settings.defaultProjectBudget,
    };

  if (usesFixedExpenseTotals(key)) {
    return {
      ...work,
      variableChargeBudget: defaultVariableChargeBudget,
      variableCharges: defaultVariableCharges,
    };
  }

  return {
    ...work,
    variableChargeBudget: work.variableChargeBudget ?? defaultVariableChargeBudget,
    variableCharges: work.variableCharges ?? defaultVariableCharges,
  };
}
