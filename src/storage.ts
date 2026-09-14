import type { Expense } from "./types";

const KEY = "gestion-depenses:v1";

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Expense[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(KEY, JSON.stringify(expenses));
}
