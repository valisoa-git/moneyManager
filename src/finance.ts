import { monthKey, parseMonthKey, type DayEntry, type MonthWork, type Settings } from "./types";

function isWeekday(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function daysOfMonth(key: string) {
  const start = parseMonthKey(key);
  const month = start.getMonth();
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getMonth() === month) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function businessDays(key: string) {
  return daysOfMonth(key).filter(isWeekday);
}

export function yearMonthKeys(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function roundDownToStep(amount: number, step: number) {
  if (step <= 0) return amount;
  return Math.floor(amount / step) * step;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function businessDaysElapsed(key: string, today = new Date()) {
  const current = monthKey(today);
  if (key < current) return businessDays(key).length;
  if (key > current) return 0;
  const limit = startOfDay(today);
  return businessDays(key).filter((d) => d.getTime() <= limit.getTime()).length;
}

function todayISOLimit(today: Date) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function weekdayLeaveDays(leaves: DayEntry[], key: string) {
  return leaves
    .filter((item) => item.date.startsWith(key) && isWeekday(new Date(`${item.date}T00:00:00`)))
    .reduce((sum, item) => sum + item.fraction, 0);
}

function extraDays(extras: DayEntry[], key: string) {
  return extras.filter((item) => item.date.startsWith(key)).reduce((sum, item) => sum + item.fraction, 0);
}

function until(entries: DayEntry[], key: string, today: Date, weekdayOnly: boolean) {
  const current = monthKey(today);
  const inMonth = entries.filter((item) => {
    if (!item.date.startsWith(key)) return false;
    if (weekdayOnly && !isWeekday(new Date(`${item.date}T00:00:00`))) return false;
    return true;
  });
  if (key < current) return inMonth.reduce((sum, item) => sum + item.fraction, 0);
  if (key > current) return 0;
  const limit = todayISOLimit(today);
  return inMonth.filter((item) => item.date <= limit).reduce((sum, item) => sum + item.fraction, 0);
}

export function personSnapshot(key: string, tjm: number, leavesInput: DayEntry[], extrasInput: DayEntry[], today = new Date()) {
  const ouvrables = businessDays(key).length;
  const elapsed = businessDaysElapsed(key, today);
  const leaves = weekdayLeaveDays(leavesInput, key);
  const leavesDone = until(leavesInput, key, today, true);
  const extras = extraDays(extrasInput, key);
  const extrasDone = until(extrasInput, key, today, false);
  const worked = Math.max(0, ouvrables - leaves + extras);
  const workedDone = Math.max(0, elapsed - leavesDone + extrasDone);

  return {
    ouvrables,
    elapsed,
    leaves,
    leavesDone,
    extras,
    extrasDone,
    worked,
    workedDone,
    earned: worked * tjm,
    earnedToDate: workedDone * tjm,
  };
}

export function monthSnapshot(key: string, settings: Settings, work: MonthWork, today = new Date()) {
  return personSnapshot(key, settings.tjm, work.leaves, work.extras, today);
}
