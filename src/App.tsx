import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarMinus,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Home,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  WalletCards,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { loadCloudStore, saveCloudStore } from "./cloudStore";
import { monthSnapshot, personSnapshot, roundDownToStep } from "./finance";
import { loadStore, monthWork, PROJECT_SEED_VERSION, saveStore, withStarterProjects } from "./storage";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import {
  formatAmountInput,
  formatDays,
  formatMoney,
  formatMonth,
  fractionLabel,
  parseAmount,
  parseFraction,
  parseMonthKey,
  shiftMonth,
  THEMES,
  todayISO,
  type BucketProject,
  type DayEntry,
  type DayFraction,
  type FixedChargeItem,
  type PersonalExpense,
  type Settings,
  type Store,
} from "./types";
import "./App.css";

type Tab = "synthese" | "travail" | "depenses" | "prevision" | "projets" | "settings";
type Sheet = "expense" | "fixedCharge" | "leave" | "extra" | "personal" | "projectBudget" | "bucketProject" | null;
type Worker = "me" | "husband";
type ExpenseView = "charges" | "personal";

const emptyExpense = {
  amount: "",
  label: "",
};

const emptyPersonalExpense = {
  label: "",
  amount: "",
  date: todayISO(),
};

const emptyFixedCharge = {
  label: "",
  amount: "",
};

const emptyProjectBudget = {
  amount: "",
};

const emptyBucketProject = {
  title: "",
  amount: "",
  plannedMonth: "",
};

const emptyLeave = { fraction: "1" as "1" | "0.5" };
const emptyExtra = { fraction: "1" as "1" | "0.5", note: "" };
const APP_START_MONTH = "2026-07";
const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function DurationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      Durée
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="1">Journée</option>
        <option value="0.5">Demi-journée</option>
      </select>
    </label>
  );
}

function ShortHead({ short, long }: { short: string; long: string }) {
  return (
    <abbr className="short-head" title={long} aria-label={long}>
      {short}
    </abbr>
  );
}

function formatBucketMonth(key: string) {
  return parseMonthKey(key).toLocaleDateString("fr-FR", {
    month: "long",
  });
}

function tabIcon(id: Tab) {
  const props = { size: 18, strokeWidth: 2.2, "aria-hidden": true };
  switch (id) {
    case "synthese":
      return <Home {...props} />;
    case "travail":
      return <BriefcaseBusiness {...props} />;
    case "depenses":
      return <WalletCards {...props} />;
    case "prevision":
      return <CalendarDays {...props} />;
    case "projets":
      return <ClipboardCheck {...props} />;
    case "settings":
      return <SettingsIcon {...props} />;
  }
}

function IconText({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <>
      {icon}
      <span>{label}</span>
    </>
  );
}

function dayLine(item: DayEntry) {
  const when = new Date(`${item.date}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${fractionLabel(item.fraction)} · ${when}`;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthCalendarCells(key: string) {
  const start = parseMonthKey(key);
  const monthIndex = start.getMonth();
  const firstDayOffset = (start.getDay() + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: firstDayOffset }, () => null);
  const cursor = new Date(start);

  while (cursor.getMonth() === monthIndex) {
    cells.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function clampToStartMonth(key: string) {
  return key < APP_START_MONTH ? APP_START_MONTH : key;
}

function monthKeyFromParts(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function forecastMonthsForYear(year: number) {
  const startMonth = year === 2026 ? 7 : 1;
  return Array.from({ length: 13 - startMonth }, (_, index) => monthKeyFromParts(year, startMonth + index));
}

function defaultDateForMonth(key: string) {
  const today = todayISO();
  return today.startsWith(key) ? today : `${key}-01`;
}

function fixedChargeTotal(settings: Settings) {
  return settings.fixedChargeItems.reduce((sum, item) => sum + item.amount, 0);
}

function availableProjectBudget(projectBudget: number, savingsBeforeProject: number) {
  return Math.max(0, Math.min(projectBudget, savingsBeforeProject));
}

function projectSummary(projects: BucketProject[]) {
  if (projects.length === 0) return "Aucun";
  const names = projects.map((project) => project.title);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function formatProjectAmount(amount: number) {
  return amount > 0 ? formatMoney(amount) : "À chiffrer";
}

function husbandLeaves(work: Store["months"][string]) {
  return work.husbandScheduleCustom ? work.husbandLeaves : work.leaves;
}

function husbandExtras(work: Store["months"][string]) {
  return work.husbandScheduleCustom ? work.husbandExtras : work.extras;
}

function monthEndDate(key: string) {
  return `${key}-${String(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
}

function updateSettings(settings: Settings, patch: Partial<Settings>): Settings {
  return { ...settings, ...patch };
}

function buildDayEntries(dateFractions: Record<string, DayFraction>, existing: DayEntry[], note = "") {
  return Object.entries(dateFractions)
    .sort()
    .map(([date, fraction]) => {
      const saved = existing.find((item) => item.date === date);
      return {
        id: saved?.id ?? crypto.randomUUID(),
        date,
        fraction,
        note: note.trim() || saved?.note || "",
      };
    });
}

function dayFractionMap(entries: DayEntry[]) {
  return Object.fromEntries(entries.map((item) => [item.date, item.fraction])) as Record<string, DayFraction>;
}

function CalendarPicker({
  month,
  mode,
  selectedFractions,
  onToggle,
}: {
  month: string;
  mode: "leave" | "extra";
  selectedFractions: Record<string, DayFraction>;
  onToggle: (date: string) => void;
}) {
  return (
    <div className="calendar-picker">
      <div className="calendar-head">
        {WEEK_DAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {monthCalendarCells(month).map((date, index) => {
          if (!date) return <span key={`empty-${index}`} className="calendar-empty" />;

          const disabled = mode === "leave" && isWeekend(date);
          const fraction = selectedFractions[date];
          const day = Number(date.slice(-2));

          return (
            <button
              key={date}
              type="button"
              className={`calendar-day ${fraction === 0.5 ? "selected half" : fraction === 1 ? "selected full" : ""}`}
              disabled={disabled}
              aria-pressed={Boolean(fraction)}
              aria-label={fraction ? `${day} ${fractionLabel(fraction)}` : String(day)}
              onClick={() => onToggle(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AuthScreen({
  mode,
  email,
  password,
  busy,
  error,
  message,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  mode: "signin" | "signup";
  email: string;
  password: string;
  busy: boolean;
  error: string;
  message: string;
  onModeChange: (mode: "signin" | "signup") => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const isSignup = mode === "signup";

  return (
    <main className="app auth-app">
      <section className="auth-panel">
        <p className="eyebrow">Money Manager</p>
        <h1>{isSignup ? "Créer un compte" : "Connexion"}</h1>
        <p className="hint">Connecte-toi pour synchroniser tes données entre ordinateur et téléphone.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="ton@email.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Minimum 6 caractères"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Patiente..." : isSignup ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        <button type="button" className="ghost auth-switch" onClick={() => onModeChange(isSignup ? "signin" : "signup")}>
          {isSignup ? "J'ai déjà un compte" : "Créer un nouveau compte"}
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [month, setMonth] = useState(APP_START_MONTH);
  const [tab, setTab] = useState<Tab>("synthese");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState(emptyLeave);
  const [extraForm, setExtraForm] = useState(emptyExtra);
  const [selectedLeaveDates, setSelectedLeaveDates] = useState<Record<string, DayFraction>>({});
  const [selectedExtraDates, setSelectedExtraDates] = useState<Record<string, DayFraction>>({});
  const [dayPerson, setDayPerson] = useState<Worker>("me");
  const [workPerson, setWorkPerson] = useState<Worker>("me");
  const [expenseView, setExpenseView] = useState<ExpenseView>("charges");
  const [personalForm, setPersonalForm] = useState(emptyPersonalExpense);
  const [editingPersonalExpense, setEditingPersonalExpense] = useState<string | null>(null);
  const [fixedChargeForm, setFixedChargeForm] = useState(emptyFixedCharge);
  const [editingFixedCharge, setEditingFixedCharge] = useState<string | null>(null);
  const [projectBudgetForm, setProjectBudgetForm] = useState(emptyProjectBudget);
  const [editingProjectMonth, setEditingProjectMonth] = useState(month);
  const [bucketProjectForm, setBucketProjectForm] = useState(emptyBucketProject);
  const [editingBucketProject, setEditingBucketProject] = useState<string | null>(null);
  const [projectMenu, setProjectMenu] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "Déconnecté" : "Local");
  const cloudUserId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveStore(store);
    const userId = session?.user.id;
    if (!supabase || !userId || cloudUserId.current !== userId) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    setSyncStatus("Sauvegarde...");
    saveTimer.current = setTimeout(() => {
      saveCloudStore(userId, store)
        .then(() => {
          setCloudError("");
          setSyncStatus("Synchronisé");
        })
        .catch((error: unknown) => {
          setCloudError(error instanceof Error ? error.message : "Impossible de sauvegarder dans Supabase.");
          setSyncStatus("Erreur cloud");
        });
    }, 650);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store, session?.user.id]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        cloudUserId.current = null;
        setSyncStatus("Déconnecté");
        setCloudLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!supabase || !userId) return;
    let mounted = true;

    setCloudLoading(true);
    setCloudError("");
    setSyncStatus("Chargement cloud...");
    loadCloudStore(userId)
      .then((cloudStore) => {
        if (!mounted) return;
        const nextStore = cloudStore ?? loadStore();
        cloudUserId.current = userId;
        setStore(nextStore);
        saveStore(nextStore);
        if (!cloudStore) void saveCloudStore(userId, nextStore);
        setSyncStatus(cloudStore ? "Synchronisé" : "Cloud initialisé");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setCloudError(error instanceof Error ? error.message : "Impossible de charger les données Supabase.");
        setSyncStatus("Erreur cloud");
      })
      .finally(() => {
        if (mounted) setCloudLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if ((store.projectSeedVersion ?? 0) < PROJECT_SEED_VERSION) {
      setStore((prev) => withStarterProjects(prev));
    }
  }, [store.projectSeedVersion]);

  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
  }, [store.settings.theme]);

  const work = monthWork(store, month);
  const snap = useMemo(
    () => monthSnapshot(month, store.settings, work),
    [month, store.settings, work],
  );
  const husbandMonthLeaves = husbandLeaves(work);
  const husbandMonthExtras = husbandExtras(work);
  const husbandSnap = useMemo(
    () => personSnapshot(month, store.settings.husbandTjm, husbandMonthLeaves, husbandMonthExtras),
    [month, store.settings.husbandTjm, husbandMonthLeaves, husbandMonthExtras],
  );
  const activeWorkSnap = workPerson === "husband" ? husbandSnap : snap;
  const activeWorkLeaves = workPerson === "husband" ? husbandMonthLeaves : work.leaves;
  const activeWorkExtras = workPerson === "husband" ? husbandMonthExtras : work.extras;
  const activeWorkTjm = workPerson === "husband" ? store.settings.husbandTjm : store.settings.tjm;

  const monthlyVariableCharges = work.variableCharges;
  const expensesTotal = monthlyVariableCharges.reduce((sum, item) => sum + item.amount, 0);
  const currentStartingSalary = roundDownToStep(snap.earned, store.settings.roundingStep);
  const currentStartingSalaryToDate = roundDownToStep(snap.earnedToDate, store.settings.roundingStep);
  const husbandStartingSalary = roundDownToStep(husbandSnap.earned, store.settings.roundingStep);
  const husbandStartingSalaryToDate = roundDownToStep(husbandSnap.earnedToDate, store.settings.roundingStep);
  const householdStartingSalary = currentStartingSalary + husbandStartingSalary;
  const householdStartingSalaryToDate = currentStartingSalaryToDate + husbandStartingSalaryToDate;
  const chargeFixed = fixedChargeTotal(store.settings);
  const chargeVariableBudget = work.variableChargeBudget;
  const chargeStart = chargeFixed + chargeVariableBudget;
  const chargeRemaining = chargeVariableBudget - expensesTotal;
  const charges = chargeFixed + expensesTotal;
  const currentPlannedProjectTotal = store.projects
    .filter((project) => project.plannedMonth === month)
    .reduce((sum, project) => sum + project.amount, 0);
  const monthlyProjectBudget = currentPlannedProjectTotal > 0 ? currentPlannedProjectTotal : work.projectBudget;
  const savingsBeforeProject = householdStartingSalary - charges;
  const savingsBeforeProjectToDate = householdStartingSalaryToDate - charges;
  const projectAvailable = availableProjectBudget(monthlyProjectBudget, savingsBeforeProject);
  const reste = savingsBeforeProject - monthlyProjectBudget;
  const resteToDate = savingsBeforeProjectToDate - monthlyProjectBudget;
  const personalStart = snap.earned - currentStartingSalary;
  const monthlyPersonalExpenses = store.personalExpenses.filter((expense) => expense.date.startsWith(month));
  const personalSpent = monthlyPersonalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const personalRemaining = personalStart - personalSpent;
  const selectedYear = Number(month.slice(0, 4));
  const canGoPrevious = tab === "prevision" ? selectedYear > 2026 : month > APP_START_MONTH;
  const isCurrent =
    month ===
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const annualProjects = useMemo(
    () =>
      store.projects
        .filter((project) => project.year === selectedYear)
        .slice()
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return (a.plannedMonth ?? "9999-99").localeCompare(b.plannedMonth ?? "9999-99") || a.amount - b.amount;
        }),
    [selectedYear, store.projects],
  );

  const annualRows = useMemo(
    () =>
      forecastMonthsForYear(selectedYear).map((key) => {
        const plannedProjects = annualProjects.filter((project) => project.plannedMonth === key);
        const plannedProjectTotal = plannedProjects.reduce((sum, project) => sum + project.amount, 0);
        const monthWorkData = monthWork(store, key);
        const monthSnap = monthSnapshot(key, store.settings, monthWorkData);
        const monthHusbandSnap = personSnapshot(
          key,
          store.settings.husbandTjm,
          husbandLeaves(monthWorkData),
          husbandExtras(monthWorkData),
        );
        const startingSalary = roundDownToStep(monthSnap.earned, store.settings.roundingStep);
        const husbandStartingSalary = roundDownToStep(monthHusbandSnap.earned, store.settings.roundingStep);
        const personalPart = monthSnap.earned - startingSalary;
        const husbandPersonalPart = monthHusbandSnap.earned - husbandStartingSalary;
        const householdStartingSalary = startingSalary + husbandStartingSalary;
        const fixedCharges = fixedChargeTotal(store.settings);
        const chargeTotal = fixedCharges + monthWorkData.variableChargeBudget;
        const savingsBeforeProject = householdStartingSalary - chargeTotal;
        const projectBudget = plannedProjectTotal > 0 ? plannedProjectTotal : monthWorkData.projectBudget;
        const projectAvailable = availableProjectBudget(projectBudget, savingsBeforeProject);
        const savings = savingsBeforeProject - projectBudget;

        return {
          key,
          label: formatMonth(key),
          ouvrables: monthSnap.ouvrables,
          leaves: monthSnap.leaves,
          extras: monthSnap.extras,
          husbandLeaves: monthHusbandSnap.leaves,
          husbandExtras: monthHusbandSnap.extras,
          worked: monthSnap.worked,
          husbandWorked: monthHusbandSnap.worked,
          earned: monthSnap.earned,
          husbandEarned: monthHusbandSnap.earned,
          startingSalary,
          husbandStartingSalary,
          householdStartingSalary,
          personalPart,
          husbandPersonalPart,
          chargeTotal,
          projectBudget,
          projectAvailable,
          plannedProjects,
          plannedProjectTotal,
          savingsBeforeProject,
          savings,
        };
      }),
    [annualProjects, selectedYear, store],
  );
  const annualSavings = annualRows.reduce((sum, row) => sum + row.savings, 0);
  const currentPlannedProjects = annualProjects.filter((project) => project.plannedMonth === month);
  const currentProjectLabel =
    currentPlannedProjects.length > 0
      ? currentPlannedProjects.map((project) => project.title).join(" · ")
      : "Aucun projet prévu";
  const currentPlannedTotal = currentPlannedProjects.reduce((sum, project) => sum + project.amount, 0);
  const plannedProjects = annualProjects.filter((project) => project.plannedMonth);
  const unscheduledProjects = annualProjects.filter((project) => !project.plannedMonth);

  function goPrevious() {
    if (!canGoPrevious) return;
    setMonth((current) => {
      if (tab === "prevision") return `${selectedYear - 1}-${selectedYear - 1 === 2026 ? "07" : "01"}`;
      return clampToStartMonth(shiftMonth(current, -1));
    });
  }

  function goNext() {
    setMonth((current) => (tab === "prevision" ? `${selectedYear + 1}-01` : shiftMonth(current, 1)));
  }

  function patchSettings(patch: Partial<Settings>) {
    setStore((prev) => ({ ...prev, settings: updateSettings(prev.settings, patch) }));
  }

  function updateMoneySetting(
    key: "tjm" | "husbandTjm" | "defaultVariableChargeBudget" | "defaultProjectBudget",
    value: string,
  ) {
    const amount = parseAmount(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    patchSettings({ [key]: amount });
  }

  function patchWork(next: Partial<typeof work>) {
    setStore((prev) => ({
      ...prev,
      months: { ...prev.months, [month]: { ...monthWork(prev, month), ...next } },
    }));
  }

  function openDaySheet(nextSheet: "leave" | "extra", targetMonth = month, targetPerson: Worker = "me") {
    const targetWork = monthWork(store, targetMonth);
    setDayPerson(targetPerson);
    if (nextSheet === "leave") {
      const sourceLeaves = targetPerson === "husband" ? husbandLeaves(targetWork) : targetWork.leaves;
      const leaves = sourceLeaves.filter((item) => item.date.startsWith(targetMonth));
      setLeaveForm({ fraction: String(leaves[0]?.fraction ?? 1) as "1" | "0.5" });
      setSelectedLeaveDates(dayFractionMap(leaves));
    } else {
      const sourceExtras = targetPerson === "husband" ? husbandExtras(targetWork) : targetWork.extras;
      const extras = sourceExtras.filter((item) => item.date.startsWith(targetMonth));
      setExtraForm({ fraction: String(extras[0]?.fraction ?? 1) as "1" | "0.5", note: "" });
      setSelectedExtraDates(dayFractionMap(extras));
    }
    setMonth(targetMonth);
    setSheet(nextSheet);
  }

  function toggleLeaveDate(date: string) {
    const fraction = parseFraction(leaveForm.fraction);
    setSelectedLeaveDates((dates) => {
      const next = { ...dates };
      if (next[date] === fraction) {
        delete next[date];
      } else {
        next[date] = fraction;
      }
      return next;
    });
  }

  function toggleExtraDate(date: string) {
    const fraction = parseFraction(extraForm.fraction);
    setSelectedExtraDates((dates) => {
      const next = { ...dates };
      if (next[date] === fraction) {
        delete next[date];
      } else {
        next[date] = fraction;
      }
      return next;
    });
  }

  function openExpense(expense?: FixedChargeItem) {
    if (expense) {
      setEditingExpense(expense.id);
      setExpenseForm({
        amount: formatAmountInput(expense.amount),
        label: expense.label,
      });
    } else {
      setEditingExpense(null);
      setExpenseForm(emptyExpense);
    }
    setSheet("expense");
  }

  function chargeExpenseAvailable() {
    const currentAmount = editingExpense
      ? (work.variableCharges.find((expense) => expense.id === editingExpense)?.amount ?? 0)
      : 0;
    return chargeRemaining + currentAmount;
  }

  function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(expenseForm.amount);
    if (!expenseForm.label.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > chargeExpenseAvailable()) return;
    const payload: FixedChargeItem = {
      id: editingExpense ?? crypto.randomUUID(),
      label: expenseForm.label.trim(),
      amount,
    };
    patchWork({
      variableCharges: editingExpense
        ? work.variableCharges.map((item) => (item.id === editingExpense ? payload : item))
        : [payload, ...work.variableCharges],
    });
    setSheet(null);
  }

  function removeExpense(id: string) {
    patchWork({ variableCharges: work.variableCharges.filter((item) => item.id !== id) });
    setSheet(null);
  }

  function openFixedCharge(item?: FixedChargeItem) {
    if (item) {
      setEditingFixedCharge(item.id);
      setFixedChargeForm({ label: item.label, amount: formatAmountInput(item.amount) });
    } else {
      setEditingFixedCharge(null);
      setFixedChargeForm(emptyFixedCharge);
    }
    setSheet("fixedCharge");
  }

  function saveFixedCharge(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(fixedChargeForm.amount);
    if (!fixedChargeForm.label.trim() || !Number.isFinite(amount) || amount < 0) return;
    const payload: FixedChargeItem = {
      id: editingFixedCharge ?? crypto.randomUUID(),
      label: fixedChargeForm.label.trim(),
      amount,
    };
    setStore((prev) => {
      const fixedChargeItems = editingFixedCharge
        ? prev.settings.fixedChargeItems.map((item) => (item.id === editingFixedCharge ? payload : item))
        : [...prev.settings.fixedChargeItems, payload];
      return {
        ...prev,
        settings: {
          ...prev.settings,
          fixedChargeItems,
          fixedCharges: fixedChargeItems.reduce((sum, item) => sum + item.amount, 0),
        },
      };
    });
    setSheet(null);
  }

  function removeFixedCharge(id: string) {
    setStore((prev) => {
      const fixedChargeItems = prev.settings.fixedChargeItems.filter((item) => item.id !== id);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          fixedChargeItems,
          fixedCharges: fixedChargeItems.reduce((sum, item) => sum + item.amount, 0),
        },
      };
    });
    setSheet(null);
  }

  function updateVariableChargeBudget(value: string) {
    const variableChargeBudget = parseAmount(value);
    if (!Number.isFinite(variableChargeBudget) || variableChargeBudget < 0) return;
    patchWork({ variableChargeBudget });
  }

  function openProjectBudget(targetMonth = month) {
    const targetWork = monthWork(store, targetMonth);
    setEditingProjectMonth(targetMonth);
    setProjectBudgetForm({ amount: formatAmountInput(targetWork.projectBudget) });
    setSheet("projectBudget");
  }

  function saveProjectBudget(e: React.FormEvent) {
    e.preventDefault();
    const projectBudget = parseAmount(projectBudgetForm.amount);
    if (!Number.isFinite(projectBudget) || projectBudget < 0) return;
    setStore((prev) => ({
      ...prev,
      months: {
        ...prev.months,
        [editingProjectMonth]: {
          ...monthWork(prev, editingProjectMonth),
          projectBudget,
        },
      },
    }));
    setSheet(null);
  }

  function saveLeave(e: React.FormEvent) {
    e.preventDefault();
    if (dayPerson === "husband") {
      patchWork({ husbandLeaves: buildDayEntries(selectedLeaveDates, husbandLeaves(work)), husbandScheduleCustom: true });
    } else {
      patchWork({ leaves: buildDayEntries(selectedLeaveDates, work.leaves) });
    }
    setSheet(null);
  }

  function saveExtra(e: React.FormEvent) {
    e.preventDefault();
    if (dayPerson === "husband") {
      patchWork({
        husbandExtras: buildDayEntries(selectedExtraDates, husbandExtras(work), extraForm.note),
        husbandScheduleCustom: true,
      });
    } else {
      patchWork({ extras: buildDayEntries(selectedExtraDates, work.extras, extraForm.note) });
    }
    setSheet(null);
  }

  function removeLeave(id: string, person: Worker = "me") {
    if (person === "husband") {
      patchWork({
        husbandLeaves: husbandLeaves(work).filter((item) => item.id !== id),
        husbandScheduleCustom: true,
      });
      return;
    }
    patchWork({ leaves: work.leaves.filter((item) => item.id !== id) });
  }

  function removeExtra(id: string, person: Worker = "me") {
    if (person === "husband") {
      patchWork({
        husbandExtras: husbandExtras(work).filter((item) => item.id !== id),
        husbandScheduleCustom: true,
      });
      return;
    }
    patchWork({ extras: work.extras.filter((item) => item.id !== id) });
  }

  function resetHusbandSchedule() {
    patchWork({ husbandLeaves: [], husbandExtras: [], husbandScheduleCustom: false });
  }

  function openPersonalExpense(expense?: PersonalExpense) {
    if (expense) {
      setEditingPersonalExpense(expense.id);
      setPersonalForm({
        label: expense.label,
        amount: formatAmountInput(expense.amount),
        date: expense.date,
      });
    } else {
      setEditingPersonalExpense(null);
      setPersonalForm({ ...emptyPersonalExpense, date: defaultDateForMonth(month) });
    }
    setSheet("personal");
  }

  function personalExpenseAvailable() {
    const currentAmount = editingPersonalExpense
      ? (store.personalExpenses.find((expense) => expense.id === editingPersonalExpense)?.amount ?? 0)
      : 0;
    return personalRemaining + currentAmount;
  }

  function savePersonalExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(personalForm.amount);
    if (!personalForm.label.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > personalExpenseAvailable()) return;
    const payload: PersonalExpense = {
      id: editingPersonalExpense ?? crypto.randomUUID(),
      label: personalForm.label.trim(),
      amount,
      date: personalForm.date,
    };
    setStore((prev) => ({
      ...prev,
      personalExpenses: editingPersonalExpense
        ? prev.personalExpenses.map((item) => (item.id === editingPersonalExpense ? payload : item))
        : [payload, ...prev.personalExpenses],
    }));
    setSheet(null);
  }

  function removePersonalExpense(id: string) {
    setStore((prev) => ({
      ...prev,
      personalExpenses: prev.personalExpenses.filter((item) => item.id !== id),
    }));
    setSheet(null);
  }

  function openBucketProject(project?: BucketProject) {
    if (project) {
      setEditingBucketProject(project.id);
      setBucketProjectForm({
        title: project.title,
        amount: formatAmountInput(project.amount),
        plannedMonth: project.plannedMonth ?? "",
      });
    } else {
      setEditingBucketProject(null);
      setBucketProjectForm(emptyBucketProject);
    }
    setSheet("bucketProject");
  }

  function saveBucketProject(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(bucketProjectForm.amount);
    if (!bucketProjectForm.title.trim() || !Number.isFinite(amount) || amount < 0) return;
    const payload: BucketProject = {
      id: editingBucketProject ?? crypto.randomUUID(),
      title: bucketProjectForm.title.trim(),
      amount,
      year: selectedYear,
      plannedMonth: bucketProjectForm.plannedMonth || undefined,
      done: editingBucketProject
        ? (store.projects.find((project) => project.id === editingBucketProject)?.done ?? false)
        : false,
    };
    setStore((prev) => ({
      ...prev,
      projects: editingBucketProject
        ? prev.projects.map((item) => (item.id === editingBucketProject ? payload : item))
        : [payload, ...prev.projects],
    }));
    setSheet(null);
  }

  function removeBucketProject(id: string) {
    setProjectMenu(null);
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.filter((item) => item.id !== id),
    }));
    setSheet(null);
  }

  function toggleProjectDone(id: string) {
    setProjectMenu(null);
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => (project.id === id ? { ...project, done: !project.done } : project)),
    }));
  }

  function projectFeasibility(project: BucketProject) {
    if (project.done) {
      return { label: "Fait", tone: "good", detail: "Déjà coché comme réalisé." };
    }
    if (project.amount <= 0) {
      return {
        label: "À chiffrer",
        tone: "muted",
        detail: project.plannedMonth
          ? `Planifié pour ${formatBucketMonth(project.plannedMonth)}, prix à compléter.`
          : "Ajoute un prix quand tu veux le planifier.",
      };
    }
    if (project.plannedMonth) {
      return {
        label: formatBucketMonth(project.plannedMonth),
        tone: "next",
        detail: `Planifié pour ${formatBucketMonth(project.plannedMonth)}.`,
      };
    }
    return {
      label: "Pas défini",
      tone: "muted",
      detail: "Choisis un mois quand tu veux le planifier.",
    };
  }

  function renderProjectTableRow(project: BucketProject) {
    const feasibility = projectFeasibility(project);
    return (
      <tr key={project.id} className={project.done ? "done" : ""}>
        <td>
          <label className="check-wrap">
            <input type="checkbox" checked={project.done} onChange={() => toggleProjectDone(project.id)} />
            <span>Fait</span>
          </label>
        </td>
        <th scope="row">
          <div className="project-title">
            <strong>{project.title}</strong>
            <small>{feasibility.detail}</small>
          </div>
        </th>
        <td>{formatProjectAmount(project.amount)}</td>
        <td>
          <span className={`status-pill ${feasibility.tone}`}>{feasibility.label}</span>
        </td>
        <td className="project-actions-cell">
          <div className="project-actions">
            <button
              type="button"
              className="action-dots"
              onClick={() => setProjectMenu((current) => (current === project.id ? null : project.id))}
              aria-label={`Actions pour ${project.title}`}
              aria-expanded={projectMenu === project.id}
            >
              <MoreVertical size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
            {projectMenu === project.id && (
              <div className="action-menu">
                <button
                  type="button"
                  onClick={() => {
                    setProjectMenu(null);
                    openBucketProject(project);
                  }}
                >
                  <IconText icon={<Pencil size={15} aria-hidden="true" />} label="Modifier" />
                </button>
                <button type="button" className="delete" onClick={() => removeBucketProject(project.id)}>
                  <IconText icon={<Trash2 size={15} aria-hidden="true" />} label="Supprimer" />
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setAuthError("Supabase n'est pas encore configuré.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    const credentials = {
      email: authEmail.trim(),
      password: authPassword,
    };
    const { data, error } =
      authMode === "signup"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setAuthError(error.message);
    } else if (authMode === "signup" && !data.session) {
      setAuthMessage("Compte créé. Vérifie ton email si Supabase demande une confirmation.");
    } else {
      setAuthMessage("");
    }
    setAuthBusy(false);
  }

  async function handleSignOut() {
    if (!supabase) return;
    setSheet(null);
    setProjectMenu(null);
    await supabase.auth.signOut();
  }

  const personalDraftAmount = parseAmount(personalForm.amount);
  const personalDraftValue = Number.isFinite(personalDraftAmount) ? personalDraftAmount : 0;
  const personalAvailable = personalExpenseAvailable();
  const personalRemainingAfterDraft = personalAvailable - personalDraftValue;
  const personalDraftTooHigh = personalDraftValue > personalAvailable;
  const chargeDraftAmount = parseAmount(expenseForm.amount);
  const chargeDraftValue = Number.isFinite(chargeDraftAmount) ? chargeDraftAmount : 0;
  const chargeAvailable = chargeExpenseAvailable();
  const chargeRemainingAfterDraft = chargeAvailable - chargeDraftValue;
  const chargeDraftTooHigh = chargeDraftValue > chargeAvailable;

  const fab =
    tab === "depenses"
      ? expenseView === "charges"
        ? { label: "Charge variable", action: () => openExpense() }
        : { label: "Dépense perso", action: () => openPersonalExpense() }
      : tab === "travail"
        ? { label: "Congé / jour sup", action: () => openDaySheet("leave", month, workPerson) }
        : tab === "projets"
          ? { label: "Projet", action: () => openBucketProject() }
          : null;

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="app auth-app">
        <section className="auth-panel">
          <p className="eyebrow">Money Manager</p>
          <h1>Supabase manque</h1>
          <p className="hint">
            Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel pour activer la connexion.
          </p>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="app auth-app">
        <section className="auth-panel">
          <p className="eyebrow">Money Manager</p>
          <h1>Chargement</h1>
          <p className="hint">Vérification de la session...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        mode={authMode}
        email={authEmail}
        password={authPassword}
        busy={authBusy}
        error={authError}
        message={authMessage}
        onModeChange={(nextMode) => {
          setAuthMode(nextMode);
          setAuthError("");
          setAuthMessage("");
        }}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className={`app ${tab === "prevision" ? "wide" : ""}`}>
      <header className="top">
        <p className="eyebrow">Money Manager</p>
        <div className="title-row">
          <h1>Caisse</h1>
          <div className="header-actions">
            <span className={`sync-pill ${cloudError ? "error" : ""}`}>{syncStatus}</span>
            <button
              type="button"
              className={`icon-btn ${tab === "settings" ? "on" : ""}`}
              onClick={() => setTab("settings")}
              aria-label="Réglages"
              title="Réglages"
            >
              <SettingsIcon size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" onClick={handleSignOut} aria-label="Déconnexion" title="Déconnexion">
              <LogOut size={19} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
        {cloudError && <p className="sync-error">{cloudError}</p>}
        {cloudLoading && <p className="sync-error neutral">Chargement des données cloud...</p>}
        <div className="month-nav">
          <button
            type="button"
            onClick={goPrevious}
            disabled={!canGoPrevious}
            aria-label={tab === "prevision" ? "Période précédente" : "Mois précédent"}
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <strong>{tab === "prevision" ? selectedYear : formatMonth(month)}</strong>
          <button
            type="button"
            onClick={goNext}
            aria-label={tab === "prevision" ? "Période suivante" : "Mois suivant"}
          >
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </header>

      {tab === "synthese" && (
        <>
          <section className="hero">
            <div>
              <p className="muted">Économie du mois</p>
              <p className={`amount ${reste < 0 ? "neg" : ""}`}>{formatMoney(reste)}</p>
            </div>
            <p className="count">
              {formatDays(snap.leaves)} congé · {formatDays(snap.extras)} sup
            </p>
          </section>

          <section className="kpis summary-kpis">
            <article>
              <p className="muted">Mon salaire calculé</p>
              <strong>{formatMoney(snap.earned)}</strong>
              <small>{formatDays(snap.worked)} jours facturés × mon salaire par jour</small>
            </article>
            <article>
              <p className="muted">Salaire calculé de mon mari</p>
              <strong>{formatMoney(husbandSnap.earned)}</strong>
              <small>{formatDays(husbandSnap.worked)} jours facturés × son salaire par jour</small>
            </article>
            <article>
              <p className="muted">Mon salaire arrondi</p>
              <strong>{formatMoney(currentStartingSalary)}</strong>
              <small>Arrondi par {formatMoney(store.settings.roundingStep)}</small>
            </article>
            <article>
              <p className="muted">Salaire arrondi nous 2</p>
              <strong>{formatMoney(householdStartingSalary)}</strong>
              <small>Total foyer après arrondi</small>
            </article>
            <article>
              <p className="muted">Ma somme perso</p>
              <strong>{formatMoney(personalStart)}</strong>
              <small>Mon salaire calculé - mon salaire arrondi</small>
            </article>
            <article>
              <p className="muted">Charges</p>
              <strong>{formatMoney(charges)}</strong>
              <small>
                {formatMoney(chargeFixed)} fixe · {formatMoney(expensesTotal)} variable
              </small>
            </article>
            <article>
              <p className="muted">Projet du mois</p>
              <strong>{currentPlannedProjects.length > 0 ? currentProjectLabel : formatMoney(monthlyProjectBudget)}</strong>
              <small>
                {currentPlannedProjects.length > 0
                  ? `Budget : ${formatMoney(monthlyProjectBudget)}`
                  : `Disponible selon le mois : ${formatMoney(projectAvailable)}`}
              </small>
            </article>
            {isCurrent && (
              <article>
                <p className="muted">À date</p>
                <strong className={resteToDate < 0 ? "neg" : ""}>{formatMoney(resteToDate)}</strong>
                <small>
                  {formatMoney(householdStartingSalaryToDate)} salaire arrondi nous 2 à date
                </small>
              </article>
            )}
          </section>
        </>
      )}

      {tab === "travail" && (
        <section className="stack">
          <div className="subtabs">
            <button
              type="button"
              className={workPerson === "me" ? "on" : ""}
              onClick={() => setWorkPerson("me")}
            >
              Moi
            </button>
            <button
              type="button"
              className={workPerson === "husband" ? "on" : ""}
              onClick={() => setWorkPerson("husband")}
            >
              Mon mari
            </button>
          </div>

          <div className="kpis">
            <article>
              <p className="muted">Jours facturés</p>
              <strong>{formatDays(activeWorkSnap.worked)}</strong>
              <small>
                TJM {formatMoney(activeWorkTjm)} · {formatDays(activeWorkSnap.leaves)} congé ·{" "}
                {formatDays(activeWorkSnap.extras)} sup
              </small>
            </article>
            <article>
              <p className="muted">Salaire calculé</p>
              <strong>{formatMoney(activeWorkSnap.earned)}</strong>
              <small>{formatDays(activeWorkSnap.ouvrables)} ouvrables ce mois</small>
            </article>
          </div>

          <div className="split-actions">
            <button type="button" className="ghost" onClick={() => openDaySheet("leave", month, workPerson)}>
              <IconText icon={<CalendarMinus size={16} aria-hidden="true" />} label="Congé" />
            </button>
            <button type="button" className="ghost" onClick={() => openDaySheet("extra", month, workPerson)}>
              <IconText icon={<CalendarPlus size={16} aria-hidden="true" />} label="Sup" />
            </button>
          </div>

          {workPerson === "husband" && (
            work.husbandScheduleCustom ? (
              <button type="button" className="ghost mini" onClick={resetHusbandSchedule}>
                <IconText icon={<RotateCcw size={15} aria-hidden="true" />} label="Même calendrier que moi" />
              </button>
            ) : (
              <p className="hint">Par défaut, les dates reprennent les mêmes congés et jours sup que moi.</p>
            )
          )}

          <h2 className="section-title">Congés</h2>
          {activeWorkLeaves.length === 0 ? (
            <p className="empty">Aucun congé ce mois.</p>
          ) : (
            activeWorkLeaves.map((item) => (
              <div key={item.id} className="row static">
                <span className="row-main">
                  <strong>{dayLine(item)}</strong>
                  <small>
                    −{formatMoney(item.fraction * activeWorkTjm)}
                    {item.note ? ` · ${item.note}` : ""}
                  </small>
                </span>
                <button type="button" className="link" onClick={() => removeLeave(item.id, workPerson)}>
                  <IconText icon={<Trash2 size={14} aria-hidden="true" />} label="Retirer" />
                </button>
              </div>
            ))
          )}

          <h2 className="section-title">Jours sup</h2>
          {activeWorkExtras.length === 0 ? (
            <p className="empty">Pas de jour sup.</p>
          ) : (
            activeWorkExtras.map((item) => (
              <div key={item.id} className="row static">
                <span className="row-main">
                  <strong>{dayLine(item)}</strong>
                  <small>
                    +{formatMoney(item.fraction * activeWorkTjm)}
                    {item.note ? ` · ${item.note}` : ""}
                  </small>
                </span>
                <button type="button" className="link" onClick={() => removeExtra(item.id, workPerson)}>
                  <IconText icon={<Trash2 size={14} aria-hidden="true" />} label="Retirer" />
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "depenses" && (
        <section className="stack">
          <div className="subtabs">
            <button
              type="button"
              className={expenseView === "charges" ? "on" : ""}
              onClick={() => setExpenseView("charges")}
            >
              Charges foyer
            </button>
            <button
              type="button"
              className={expenseView === "personal" ? "on" : ""}
              onClick={() => setExpenseView("personal")}
            >
              Perso
            </button>
          </div>
        </section>
      )}

      {tab === "depenses" && expenseView === "charges" && (
        <>
          <section className="hero compact">
            <div>
              <p className="muted">Reste charges variables</p>
              <p className={`amount ${chargeRemaining < 0 ? "neg" : ""}`}>{formatMoney(chargeRemaining)}</p>
            </div>
            <p className="count">
              {monthlyVariableCharges.length} ligne{monthlyVariableCharges.length > 1 ? "s" : ""}
            </p>
          </section>

          <section className="kpis">
            <article>
              <p className="muted">Somme de départ charges</p>
              <strong>{formatMoney(chargeStart)}</strong>
              <small>{formatMoney(chargeFixed)} fixe + {formatMoney(chargeVariableBudget)} variable</small>
            </article>
            <article>
              <p className="muted">Dépenses variables</p>
              <strong>{formatMoney(expensesTotal)}</strong>
              <small>Limite à ne pas dépasser : {formatMoney(chargeVariableBudget)}</small>
            </article>
          </section>

          <section className="stack">
            <div className="section-head">
              <h2 className="section-title">Charges fixes</h2>
              <button type="button" className="ghost mini" onClick={() => openFixedCharge()}>
                <IconText icon={<Plus size={15} aria-hidden="true" />} label="Ajouter" />
              </button>
            </div>
            {store.settings.fixedChargeItems.map((item) => (
              <button key={item.id} type="button" className="row" onClick={() => openFixedCharge(item)}>
                <span className="row-main">
                  <strong>{item.label}</strong>
                </span>
                <span className="row-amt">{formatMoney(item.amount)}</span>
              </button>
            ))}
          </section>

          <section className="card">
            <label>
              Charge variable du mois
              <input
                inputMode="decimal"
                value={formatAmountInput(chargeVariableBudget)}
                onChange={(e) => updateVariableChargeBudget(e.target.value)}
              />
            </label>
            <p className="hint">La charge fixe reste à {formatMoney(chargeFixed)}. La partie variable peut changer selon le mois.</p>
          </section>

          <section className="list">
            {monthlyVariableCharges.length === 0 ? (
              <p className="empty">Aucune charge variable ce mois-ci.</p>
            ) : (
              monthlyVariableCharges
                .slice()
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((expense) => (
                  <button key={expense.id} type="button" className="row" onClick={() => openExpense(expense)}>
                    <span className="row-main">
                      <strong>{expense.label}</strong>
                    </span>
                    <span className="row-amt">{formatMoney(expense.amount)}</span>
                  </button>
                ))
            )}
          </section>
        </>
      )}

      {tab === "depenses" && expenseView === "personal" && (
        <section className="stack">
          <section className="hero compact">
            <div>
              <p className="muted">Reste perso disponible</p>
              <p className={`amount ${personalRemaining < 0 ? "neg" : ""}`}>{formatMoney(personalRemaining)}</p>
            </div>
            <p className="count">
              {monthlyPersonalExpenses.length} dépense{monthlyPersonalExpenses.length > 1 ? "s" : ""}
            </p>
          </section>

          <section className="kpis">
            <article>
              <p className="muted">Somme perso toi</p>
              <strong>{formatMoney(personalStart)}</strong>
              <small>{formatMoney(snap.earned)} gagné toi - {formatMoney(currentStartingSalary)} salaire arrondi</small>
            </article>
            <article>
              <p className="muted">Dépenses perso</p>
              <strong>{formatMoney(personalSpent)}</strong>
              <small>Limite à ne pas dépasser : {formatMoney(personalStart)}</small>
            </article>
          </section>

          {monthlyPersonalExpenses.length === 0 ? (
            <p className="empty">Aucune dépense perso ce mois-ci.</p>
          ) : (
            monthlyPersonalExpenses
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((expense) => (
              <button key={expense.id} type="button" className="row" onClick={() => openPersonalExpense(expense)}>
                <span className="row-main">
                  <strong>{expense.label}</strong>
                  <small>{new Date(`${expense.date}T00:00:00`).toLocaleDateString("fr-FR")}</small>
                </span>
                <span className="row-amt">{formatMoney(expense.amount)}</span>
              </button>
              ))
          )}
        </section>
      )}

      {tab === "projets" && (
        <section className="stack">
          <section className="hero compact">
            <div>
              <p className="muted">Projet du mois</p>
              <p className="amount project-label">{currentProjectLabel}</p>
            </div>
            <p className="count">
              {currentPlannedTotal > 0 ? formatMoney(currentPlannedTotal) : "0 projet"}
            </p>
          </section>

          <section className="card project-month-card">
            <div className="section-head">
              <h2 className="section-title">Projet de {formatMonth(month)}</h2>
              {currentPlannedTotal > 0 && <span className="status-pill">{formatMoney(currentPlannedTotal)}</span>}
            </div>
            {currentPlannedProjects.length > 0 ? (
              <div className="project-month-list">
                {currentPlannedProjects.map((project) => (
                  <button key={project.id} type="button" className="row" onClick={() => openBucketProject(project)}>
                    <span className="row-main">
                      <strong>{project.title}</strong>
                      <small>{project.done ? "Déjà fait" : "Planifié ce mois-ci"}</small>
                    </span>
                    <span className="row-amt">{formatMoney(project.amount)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty">Aucun projet planifié pour ce mois.</p>
            )}
          </section>

          <section className="stack">
            <div className="section-head">
              <h2 className="section-title">Tableau bucket list</h2>
              <button type="button" className="ghost mini" onClick={() => openBucketProject()}>
                <IconText icon={<Plus size={15} aria-hidden="true" />} label="Ajouter" />
              </button>
            </div>
            {annualProjects.length === 0 ? (
              <p className="empty">Aucun projet dans la bucket list.</p>
            ) : (
              <div className="bucket-table-wrap">
                <table className="bucket-table">
                  <thead>
                    <tr>
                      <th>Fait</th>
                      <th>Projet</th>
                      <th>Prix</th>
                      <th>Mois</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>{annualProjects.map(renderProjectTableRow)}</tbody>
                </table>
              </div>
            )}
            <p className="hint">
              {plannedProjects.length} planifié{plannedProjects.length > 1 ? "s" : ""} · {unscheduledProjects.length} sans mois ·{" "}
              {annualProjects.length} projet{annualProjects.length > 1 ? "s" : ""} au total
            </p>
          </section>
        </section>
      )}

      {tab === "prevision" && (
        <section className="stack">
          <section className="forecast-controls">
            <div className="setting-static">
              <span>Charge / mois</span>
              <strong>{formatMoney(chargeStart)}</strong>
            </div>
            <div className="setting-static">
              <span>Projet / mois</span>
              <strong>{formatMoney(monthlyProjectBudget)}</strong>
            </div>
            <label>
              Arrondi salaire départ
              <select
                value={store.settings.roundingStep}
                onChange={(e) =>
                  patchSettings({ roundingStep: Number(e.target.value) === 1_000_000 ? 1_000_000 : 500_000 })
                }
              >
                <option value={500_000}>500</option>
                <option value={1_000_000}>1000</option>
              </select>
            </label>
          </section>

          <section className="forecast">
            <div className="forecast-legend">
              <span className="legend-mine">Moi</span>
              <span className="legend-partner">Mon mari</span>
              <span className="legend-shared">Commun</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="col-shared"><ShortHead short="Mois" long="Mois" /></th>
                  <th className="col-shared"><ShortHead short="JO" long="Jours ouvrables" /></th>
                  <th className="col-mine"><ShortHead short="C.Moi" long="Congés moi" /></th>
                  <th className="col-mine"><ShortHead short="Sup.Moi" long="Jours sup moi" /></th>
                  <th className="col-mine"><ShortHead short="Tr.Moi" long="Jours travaillés moi" /></th>
                  <th className="col-partner"><ShortHead short="C.Mari" long="Congés mari" /></th>
                  <th className="col-partner"><ShortHead short="Sup.Mari" long="Jours sup mari" /></th>
                  <th className="col-partner"><ShortHead short="Tr.Mari" long="Jours travaillés mari" /></th>
                  <th className="col-mine"><ShortHead short="Brut.Moi" long="Mon salaire avant arrondi" /></th>
                  <th className="col-partner"><ShortHead short="Brut.Mari" long="Salaire de mon mari avant arrondi" /></th>
                  <th className="col-shared"><ShortHead short="Arr.2" long="Total arrondi nous 2" /></th>
                  <th className="col-mine"><ShortHead short="Sal.Moi" long="Salaire arrondi moi" /></th>
                  <th className="col-partner"><ShortHead short="Sal.Mari" long="Salaire arrondi mari" /></th>
                  <th className="col-mine"><ShortHead short="Perso" long="Ma somme perso" /></th>
                  <th className="col-partner"><ShortHead short="Perso.M" long="Somme perso de mon mari" /></th>
                  <th className="col-shared"><ShortHead short="Ch" long="Charge" /></th>
                  <th className="col-shared"><ShortHead short="Proj.Liste" long="Projets planifiés" /></th>
                  <th className="col-shared"><ShortHead short="Proj.Bud" long="Budget projet du mois" /></th>
                  <th className="col-shared"><ShortHead short="Eco" long="Économie après projet" /></th>
                </tr>
              </thead>
              <tbody>
                {annualRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="col-shared">{row.label}</th>
                    <td className="col-shared">{row.ouvrables}</td>
                    <td className="col-mine">
                      <button type="button" className="table-action" onClick={() => openDaySheet("leave", row.key, "me")}>
                        {formatDays(row.leaves)}
                      </button>
                    </td>
                    <td className="col-mine">
                      <button type="button" className="table-action" onClick={() => openDaySheet("extra", row.key, "me")}>
                        {formatDays(row.extras)}
                      </button>
                    </td>
                    <td className="col-mine">{formatDays(row.worked)}</td>
                    <td className="col-partner">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => openDaySheet("leave", row.key, "husband")}
                      >
                        {formatDays(row.husbandLeaves)}
                      </button>
                    </td>
                    <td className="col-partner">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => openDaySheet("extra", row.key, "husband")}
                      >
                        {formatDays(row.husbandExtras)}
                      </button>
                    </td>
                    <td className="col-partner">{formatDays(row.husbandWorked)}</td>
                    <td className="col-mine">{formatMoney(row.earned)}</td>
                    <td className="col-partner">{formatMoney(row.husbandEarned)}</td>
                    <td className="col-shared strong-cell">{formatMoney(row.householdStartingSalary)}</td>
                    <td className="col-mine">{formatMoney(row.startingSalary)}</td>
                    <td className="col-partner">{formatMoney(row.husbandStartingSalary)}</td>
                    <td className="col-mine">{formatMoney(row.personalPart)}</td>
                    <td className="col-partner">{formatMoney(row.husbandPersonalPart)}</td>
                    <td className="col-shared">{formatMoney(row.chargeTotal)}</td>
                    <td className="col-shared text-cell">
                      <span>{projectSummary(row.plannedProjects)}</span>
                      {row.plannedProjectTotal > 0 && <small>{formatMoney(row.plannedProjectTotal)}</small>}
                    </td>
                    <td className="col-shared">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => {
                          if (row.plannedProjectTotal > 0) {
                            setMonth(row.key);
                            setTab("projets");
                          } else {
                            openProjectBudget(row.key);
                          }
                        }}
                      >
                        {formatMoney(row.projectBudget)}
                      </button>
                    </td>
                    <td className={`col-shared ${row.savings < 0 ? "neg" : ""}`}>{formatMoney(row.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="annual-total">
            <p className="muted">Total économies de l’année après projets</p>
            <strong className={annualSavings < 0 ? "neg" : ""}>{formatMoney(annualSavings)}</strong>
          </section>
        </section>
      )}

      {tab === "settings" && (
        <section className="stack">
          <section className="hero compact">
            <div>
              <p className="muted">Paramètres</p>
              <p className="amount">Réglages</p>
            </div>
            <p className="count">300 = 300 000 Ar</p>
          </section>

          <section className="card">
            <label>
              Mon salaire par jour
              <input
                inputMode="decimal"
                value={formatAmountInput(store.settings.tjm)}
                onChange={(e) => updateMoneySetting("tjm", e.target.value)}
              />
            </label>
            <label>
              Salaire par jour de mon mari
              <input
                inputMode="decimal"
                value={formatAmountInput(store.settings.husbandTjm)}
                onChange={(e) => updateMoneySetting("husbandTjm", e.target.value)}
              />
            </label>
            <label>
              Charge fixe
              <span className="readonly-value">{formatMoney(chargeFixed)}</span>
            </label>
            <label>
              Charge variable par défaut
              <input
                inputMode="decimal"
                value={formatAmountInput(store.settings.defaultVariableChargeBudget)}
                onChange={(e) => updateMoneySetting("defaultVariableChargeBudget", e.target.value)}
              />
            </label>
            <label>
              Projet du mois par défaut
              <input
                inputMode="decimal"
                value={formatAmountInput(store.settings.defaultProjectBudget)}
                onChange={(e) => updateMoneySetting("defaultProjectBudget", e.target.value)}
              />
            </label>
            <label>
              Arrondi salaire départ
              <select
                value={store.settings.roundingStep}
                onChange={(e) =>
                  patchSettings({ roundingStep: Number(e.target.value) === 1_000_000 ? 1_000_000 : 500_000 })
                }
              >
                <option value={500_000}>500</option>
                <option value={1_000_000}>1000</option>
              </select>
            </label>
            <div className="theme-field">
              <span>Thème</span>
              <div className="theme-grid">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-choice theme-${theme.id} ${store.settings.theme === theme.id ? "on" : ""}`}
                    onClick={() => patchSettings({ theme: theme.id })}
                    aria-pressed={store.settings.theme === theme.id}
                  >
                    <span className="swatches" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <strong>{theme.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </section>
      )}

      <nav className="tabs">
        {(
          [
            ["synthese", "Résumé"],
            ["travail", "Travail"],
            ["depenses", "Dépenses"],
            ["prevision", "Prévision"],
            ["projets", "Projets"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {tabIcon(id)}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {fab && (
        <button type="button" className="fab" onClick={fab.action}>
          <IconText icon={<Plus size={18} aria-hidden="true" />} label={fab.label} />
        </button>
      )}

      {sheet === "expense" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveExpense}>
            <h2>{editingExpense ? "Modifier charge" : "Charge variable"}</h2>
            <label>
              Libellé
              <input
                value={expenseForm.label}
                onChange={(e) => setExpenseForm({ ...expenseForm, label: e.target.value })}
                placeholder="Couche, goûter, imprévu…"
                autoFocus
                required
              />
            </label>
            <label>
              Valeur
              <input
                inputMode="decimal"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="300"
                required
              />
            </label>
            <div className="personal-live">
              <span>Variable disponible</span>
              <strong>{formatMoney(chargeAvailable)}</strong>
              <span>Reste après ajout</span>
              <strong className={chargeRemainingAfterDraft < 0 ? "neg" : ""}>
                {formatMoney(chargeRemainingAfterDraft)}
              </strong>
            </div>
            {chargeDraftTooHigh && <p className="hint neg">Cette charge dépasse le budget variable disponible.</p>}
            <div className="actions">
              {editingExpense && (
                <button type="button" className="danger" onClick={() => removeExpense(editingExpense)}>
                  <IconText icon={<Trash2 size={15} aria-hidden="true" />} label="Supprimer" />
                </button>
              )}
              <button
                type="submit"
                className="primary"
                disabled={
                  chargeDraftTooHigh ||
                  chargeDraftValue <= 0 ||
                  !Number.isFinite(chargeDraftAmount) ||
                  !expenseForm.label.trim()
                }
              >
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "fixedCharge" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveFixedCharge}>
            <h2>{editingFixedCharge ? "Modifier charge fixe" : "Charge fixe"}</h2>
            <label>
              Libellé
              <input
                value={fixedChargeForm.label}
                onChange={(e) => setFixedChargeForm({ ...fixedChargeForm, label: e.target.value })}
                placeholder="Essence, jirama, provision…"
                autoFocus
                required
              />
            </label>
            <label>
              Valeur
              <input
                inputMode="decimal"
                value={fixedChargeForm.amount}
                onChange={(e) => setFixedChargeForm({ ...fixedChargeForm, amount: e.target.value })}
                placeholder="300"
                required
              />
            </label>
            <p className="hint">Écris 300 pour 300 000 Ar.</p>
            <div className="actions">
              {editingFixedCharge && (
                <button type="button" className="danger" onClick={() => removeFixedCharge(editingFixedCharge)}>
                  <IconText icon={<Trash2 size={15} aria-hidden="true" />} label="Supprimer" />
                </button>
              )}
              <button
                type="submit"
                className="primary"
                disabled={
                  !fixedChargeForm.label.trim() ||
                  !Number.isFinite(parseAmount(fixedChargeForm.amount)) ||
                  parseAmount(fixedChargeForm.amount) < 0
                }
              >
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "leave" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet work-sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveLeave}>
            <div className="sheet-title">
              <h2>Congés</h2>
              <strong>{formatMonth(month)}</strong>
            </div>
            <DurationField
              value={leaveForm.fraction}
              onChange={(fraction) => setLeaveForm({ ...leaveForm, fraction: fraction as "1" | "0.5" })}
            />
            <CalendarPicker
              month={month}
              mode="leave"
              selectedFractions={selectedLeaveDates}
              onToggle={toggleLeaveDate}
            />
            <p className="hint">
              {Object.keys(selectedLeaveDates).length} date{Object.keys(selectedLeaveDates).length > 1 ? "s" : ""} sélectionnée
              {Object.keys(selectedLeaveDates).length > 1 ? "s" : ""}. Les week-ends sont ignorés.
            </p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => openDaySheet("extra", month, dayPerson)}>
                <IconText icon={<CalendarPlus size={16} aria-hidden="true" />} label="Jour sup" />
              </button>
              <button type="submit" className="primary">
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "extra" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet work-sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveExtra}>
            <div className="sheet-title">
              <h2>Jours sup</h2>
              <strong>{formatMonth(month)}</strong>
            </div>
            <DurationField
              value={extraForm.fraction}
              onChange={(fraction) => setExtraForm({ ...extraForm, fraction: fraction as "1" | "0.5" })}
            />
            <CalendarPicker
              month={month}
              mode="extra"
              selectedFractions={selectedExtraDates}
              onToggle={toggleExtraDate}
            />
            <label>
              Note
              <input
                value={extraForm.note}
                onChange={(e) => setExtraForm({ ...extraForm, note: e.target.value })}
                placeholder="Weekend, rattrapage…"
              />
            </label>
            <p className="hint">
              {Object.keys(selectedExtraDates).length} date{Object.keys(selectedExtraDates).length > 1 ? "s" : ""} sélectionnée
              {Object.keys(selectedExtraDates).length > 1 ? "s" : ""}.
            </p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => openDaySheet("leave", month, dayPerson)}>
                <IconText icon={<CalendarMinus size={16} aria-hidden="true" />} label="Congé" />
              </button>
              <button type="submit" className="primary">
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "personal" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={savePersonalExpense}>
            <h2>{editingPersonalExpense ? "Modifier dépense perso" : "Dépense perso"}</h2>
            <label>
              Libellé
              <input
                value={personalForm.label}
                onChange={(e) => setPersonalForm({ ...personalForm, label: e.target.value })}
                placeholder="Restaurant, vêtement, sortie…"
                autoFocus
                required
              />
            </label>
            <label>
              Valeur
              <input
                inputMode="decimal"
                value={personalForm.amount}
                onChange={(e) => setPersonalForm({ ...personalForm, amount: e.target.value })}
                placeholder="50"
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={personalForm.date}
                min={`${month}-01`}
                max={monthEndDate(month)}
                onChange={(e) => setPersonalForm({ ...personalForm, date: e.target.value })}
                required
              />
            </label>
            <div className="personal-live">
              <span>Disponible</span>
              <strong>{formatMoney(personalAvailable)}</strong>
              <span>Reste après ajout</span>
              <strong className={personalRemainingAfterDraft < 0 ? "neg" : ""}>
                {formatMoney(personalRemainingAfterDraft)}
              </strong>
            </div>
            {personalDraftTooHigh && <p className="hint neg">Cette dépense dépasse le reste disponible.</p>}
            <div className="actions">
              {editingPersonalExpense && (
                <button type="button" className="danger" onClick={() => removePersonalExpense(editingPersonalExpense)}>
                  <IconText icon={<Trash2 size={15} aria-hidden="true" />} label="Supprimer" />
                </button>
              )}
              <button
                type="submit"
                className="primary"
                disabled={
                  personalDraftTooHigh ||
                  personalDraftValue <= 0 ||
                  !Number.isFinite(personalDraftAmount) ||
                  !personalForm.label.trim()
                }
              >
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "projectBudget" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveProjectBudget}>
            <div className="sheet-title">
              <h2>Projet du mois</h2>
              <strong>{formatMonth(editingProjectMonth)}</strong>
            </div>
            <label>
              Budget
              <input
                inputMode="decimal"
                value={projectBudgetForm.amount}
                onChange={(e) => setProjectBudgetForm({ amount: e.target.value })}
                placeholder="1000"
                autoFocus
                required
              />
            </label>
            <p className="hint">Écris 1000 pour 1 000 000 Ar.</p>
            <div className="actions">
              <button
                type="submit"
                className="primary"
                disabled={
                  !Number.isFinite(parseAmount(projectBudgetForm.amount)) || parseAmount(projectBudgetForm.amount) < 0
                }
              >
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === "bucketProject" && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveBucketProject}>
            <div className="sheet-title">
              <h2>{editingBucketProject ? "Modifier projet" : "Projet"}</h2>
              <strong>{selectedYear}</strong>
            </div>
            <label>
              Libellé
              <input
                value={bucketProjectForm.title}
                onChange={(e) => setBucketProjectForm({ ...bucketProjectForm, title: e.target.value })}
                placeholder="Téléphone, voyage, meuble…"
                autoFocus
                required
              />
            </label>
            <label>
              Prix
              <input
                inputMode="decimal"
                value={bucketProjectForm.amount}
                onChange={(e) => setBucketProjectForm({ ...bucketProjectForm, amount: e.target.value })}
                placeholder="0 si pas encore chiffré"
                required
              />
            </label>
            <label>
              Mois prévu
              <select
                value={bucketProjectForm.plannedMonth}
                onChange={(e) => setBucketProjectForm({ ...bucketProjectForm, plannedMonth: e.target.value })}
              >
                <option value="">Pas encore défini</option>
                {forecastMonthsForYear(selectedYear).map((key) => (
                  <option key={key} value={key}>
                    {formatMonth(key)}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">Sans mois prévu, le projet reste dans la checklist libre de {selectedYear}.</p>
            <div className="actions">
              {editingBucketProject && (
                <button type="button" className="danger" onClick={() => removeBucketProject(editingBucketProject)}>
                  <IconText icon={<Trash2 size={15} aria-hidden="true" />} label="Supprimer" />
                </button>
              )}
              <button
                type="submit"
                className="primary"
                disabled={
                  !bucketProjectForm.title.trim() ||
                  !Number.isFinite(parseAmount(bucketProjectForm.amount)) ||
                  parseAmount(bucketProjectForm.amount) < 0
                }
              >
                <IconText icon={<Save size={15} aria-hidden="true" />} label="Enregistrer" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
