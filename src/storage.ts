import {
  DEFAULT_FIXED_CHARGES,
  DEFAULT_FIXED_CHARGE_ITEMS,
  DEFAULT_PROJECT_BUDGET,
  DEFAULT_SETTINGS,
  DEFAULT_VARIABLE_CHARGE_BUDGET,
  DEFAULT_VARIABLE_CHARGE_ITEMS,
  EMPTY_MONTH,
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

function migrateMonth(raw: unknown, defaultVariableChargeBudget: number, defaultProjectBudget: number): MonthWork {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_MONTH, variableChargeBudget: defaultVariableChargeBudget, projectBudget: defaultProjectBudget };
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
    projectBudget:
      typeof month.projectBudget === "number" && month.projectBudget >= 0 ? month.projectBudget : defaultProjectBudget,
  };
}

function addLegacyExpensesToMonths(
  months: Store["months"],
  expenses: Expense[],
  defaultVariableChargeBudget: number,
  defaultProjectBudget: number,
) {
  for (const expense of expenses) {
    const key = expense.date.slice(0, 7);
    if (!key) continue;
    const month = months[key] ?? {
      ...EMPTY_MONTH,
      variableChargeBudget: defaultVariableChargeBudget,
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
    fixedCharges:
      typeof parsed.settings?.fixedCharges === "number" && parsed.settings.fixedCharges >= 0
        ? parsed.settings.fixedCharges
        : DEFAULT_SETTINGS.fixedCharges,
    fixedChargeItems: migrateFixedChargeItems(parsed.settings?.fixedChargeItems),
    defaultVariableChargeBudget:
      typeof parsed.settings?.defaultVariableChargeBudget === "number" && parsed.settings.defaultVariableChargeBudget >= 0
        ? parsed.settings.defaultVariableChargeBudget
        : DEFAULT_VARIABLE_CHARGE_BUDGET,
    defaultProjectBudget:
      typeof parsed.settings?.defaultProjectBudget === "number" && parsed.settings.defaultProjectBudget >= 0
        ? parsed.settings.defaultProjectBudget
        : DEFAULT_PROJECT_BUDGET,
    roundingStep: parsed.settings?.roundingStep === 1_000_000 ? 1_000_000 : 500_000,
    theme: migrateTheme(parsed.settings?.theme),
  };
}

function migrateStore(parsed: RawStore, options: { legacyV2?: boolean } = {}): Store {
  const settings = migrateSettings(parsed, options);
  const months: Store["months"] = {};
  for (const [key, value] of Object.entries(parsed.months ?? {})) {
    months[key] = migrateMonth(value, settings.defaultVariableChargeBudget, settings.defaultProjectBudget);
  }
  addLegacyExpensesToMonths(
    months,
    parsed.expenses ?? [],
    settings.defaultVariableChargeBudget,
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
        addLegacyExpensesToMonths(months, parsed, DEFAULT_VARIABLE_CHARGE_BUDGET, DEFAULT_PROJECT_BUDGET);
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
  return (
    store.months[key] ?? {
      ...EMPTY_MONTH,
      variableChargeBudget: store.settings.defaultVariableChargeBudget,
      variableCharges: DEFAULT_VARIABLE_CHARGE_ITEMS,
      projectBudget: store.settings.defaultProjectBudget,
    }
  );
}
