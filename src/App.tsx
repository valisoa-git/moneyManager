import { useEffect, useMemo, useState } from "react";
import { monthSnapshot, personSnapshot, roundDownToStep } from "./finance";
import { loadStore, monthWork, saveStore } from "./storage";
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
  type DayEntry,
  type DayFraction,
  type FixedChargeItem,
  type PersonalExpense,
  type Settings,
  type Store,
} from "./types";
import "./App.css";

type Tab = "synthese" | "travail" | "depenses" | "prevision" | "settings";
type Sheet = "expense" | "fixedCharge" | "leave" | "extra" | "personal" | null;
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

  useEffect(() => {
    saveStore(store);
  }, [store]);

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
  const reste = householdStartingSalary - charges;
  const resteToDate = householdStartingSalaryToDate - charges;
  const personalStart = snap.earned - currentStartingSalary;
  const monthlyPersonalExpenses = store.personalExpenses.filter((expense) => expense.date.startsWith(month));
  const personalSpent = monthlyPersonalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const personalRemaining = personalStart - personalSpent;
  const selectedYear = Number(month.slice(0, 4));
  const canGoPrevious = tab === "prevision" ? selectedYear > 2026 : month > APP_START_MONTH;
  const isCurrent =
    month ===
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const annualRows = useMemo(
    () =>
      forecastMonthsForYear(selectedYear).map((key) => {
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
        const savings = householdStartingSalary - chargeTotal;

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
          savings,
        };
      }),
    [selectedYear, store],
  );
  const annualSavings = annualRows.reduce((sum, row) => sum + row.savings, 0);

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

  function updateMoneySetting(key: "tjm" | "husbandTjm" | "defaultVariableChargeBudget", value: string) {
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
        ? { label: "+ Charge variable", action: () => openExpense() }
        : { label: "+ Dépense perso", action: () => openPersonalExpense() }
      : tab === "travail"
        ? { label: "+ Congé / jour sup", action: () => openDaySheet("leave", month, workPerson) }
        : null;

  return (
    <div className={`app ${tab === "prevision" ? "wide" : ""}`}>
      <header className="top">
        <p className="eyebrow">Freelance · local</p>
        <h1>Caisse</h1>
        <div className="month-nav">
          <button
            type="button"
            onClick={goPrevious}
            disabled={!canGoPrevious}
            aria-label={tab === "prevision" ? "Période précédente" : "Mois précédent"}
          >
            ‹
          </button>
          <strong>{tab === "prevision" ? selectedYear : formatMonth(month)}</strong>
          <button
            type="button"
            onClick={goNext}
            aria-label={tab === "prevision" ? "Période suivante" : "Mois suivant"}
          >
            ›
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

          <section className="kpis">
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
              + Congé
            </button>
            <button type="button" className="ghost" onClick={() => openDaySheet("extra", month, workPerson)}>
              + Sup
            </button>
          </div>

          {workPerson === "husband" && (
            work.husbandScheduleCustom ? (
              <button type="button" className="ghost mini" onClick={resetHusbandSchedule}>
                Même calendrier que moi
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
                  Retirer
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
                  Retirer
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
                + Ajouter
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

      {tab === "prevision" && (
        <section className="stack">
          <section className="forecast-controls">
            <div className="setting-static">
              <span>Charge / mois</span>
              <strong>{formatMoney(chargeStart)}</strong>
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
                  <th className="col-shared"><ShortHead short="Eco" long="Économie" /></th>
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
                    <td className={`col-shared ${row.savings < 0 ? "neg" : ""}`}>{formatMoney(row.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="annual-total">
            <p className="muted">Total économies de l’année</p>
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
            ["settings", "Réglages"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {fab && (
        <button type="button" className="fab" onClick={fab.action}>
          {fab.label}
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
                  Supprimer
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
                Enregistrer
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
                  Supprimer
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
                Enregistrer
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
                Jour sup
              </button>
              <button type="submit" className="primary">
                Enregistrer
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
                Congé
              </button>
              <button type="submit" className="primary">
                Enregistrer
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
                  Supprimer
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
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
