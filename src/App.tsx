import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  categoryOf,
  formatMoney,
  formatMonth,
  monthKey,
  shiftMonth,
  todayISO,
  type CategoryId,
  type Expense,
} from "./types";
import { loadExpenses, saveExpenses } from "./storage";
import "./App.css";

const emptyForm = {
  amount: "",
  category: "alimentation" as CategoryId,
  note: "",
  date: todayISO(),
};

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  const monthly = useMemo(
    () => expenses.filter((e) => monthKey(e.date) === month),
    [expenses, month],
  );

  const total = monthly.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = CATEGORIES.map((cat) => {
    const amount = monthly
      .filter((e) => e.category === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { ...cat, amount };
  }).filter((c) => c.amount > 0);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, date: todayISO() });
    setOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      note: expense.note,
      date: expense.date,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;

    const payload: Expense = {
      id: editingId ?? crypto.randomUUID(),
      amount,
      category: form.category,
      note: form.note.trim(),
      date: form.date,
    };

    setExpenses((prev) => {
      if (editingId) return prev.map((item) => (item.id === editingId ? payload : item));
      return [payload, ...prev];
    });
    setOpen(false);
  }

  function remove(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setOpen(false);
  }

  return (
    <div className="app">
      <header className="top">
        <p className="eyebrow">Local · sans compte</p>
        <h1>Dépenses</h1>
        <div className="month-nav">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">
            ‹
          </button>
          <strong>{formatMonth(month)}</strong>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">
            ›
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="muted">Total du mois</p>
          <p className="amount">{formatMoney(total)}</p>
        </div>
        <p className="count">
          {monthly.length} dépense{monthly.length > 1 ? "s" : ""}
        </p>
      </section>

      {byCategory.length > 0 && (
        <section className="cats">
          {byCategory.map((cat) => (
            <div key={cat.id} className="cat">
              <div className="cat-row">
                <span style={{ color: cat.color }}>{cat.label}</span>
                <span>{formatMoney(cat.amount)}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${(cat.amount / total) * 100}%`, background: cat.color }} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="list">
        {monthly.length === 0 ? (
          <p className="empty">Rien ce mois-ci. Ajoute une dépense.</p>
        ) : (
          monthly
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((expense) => {
              const cat = categoryOf(expense.category);
              return (
                <button key={expense.id} type="button" className="row" onClick={() => openEdit(expense)}>
                  <span className="dot" style={{ background: cat.color }} />
                  <span className="row-main">
                    <strong>{expense.note || cat.label}</strong>
                    <small>
                      {cat.label} · {new Date(`${expense.date}T00:00:00`).toLocaleDateString("fr-FR")}
                    </small>
                  </span>
                  <span className="row-amt">{formatMoney(expense.amount)}</span>
                </button>
              );
            })
        )}
      </section>

      <button type="button" className="fab" onClick={openCreate}>
        + Ajouter
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>{editingId ? "Modifier" : "Nouvelle dépense"}</h2>
            <label>
              Montant
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="25000"
                autoFocus
                required
              />
            </label>
            <label>
              Catégorie
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CategoryId })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
            <label>
              Note
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Marché, taxi, loyer…"
              />
            </label>
            <div className="actions">
              {editingId && (
                <button type="button" className="danger" onClick={() => remove(editingId)}>
                  Supprimer
                </button>
              )}
              <button type="submit" className="primary">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
