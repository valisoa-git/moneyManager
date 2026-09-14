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
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MGA",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
