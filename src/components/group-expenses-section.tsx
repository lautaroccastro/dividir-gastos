"use client";

import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { amountToCents, splitAmountCentsEvenly } from "@/lib/expense/split";
import {
  EXPENSE_TITLE_MAX,
  formatExpenseDateDdMmYy,
  todayIso,
  toDateInputValue,
} from "@/lib/validation/expense";
import { useMemo, useState, useTransition } from "react";

export type GroupExpenseParticipant = {
  id: string;
  display_name: string;
  sort_order: number;
};

export type GroupExpenseRow = {
  id: string;
  title: string;
  amount: string;
  expense_date: string;
  paid_by_participant_id: string;
  splitParticipantIds: string[];
};

type Props = {
  groupId: string;
  currency: string;
  participants: GroupExpenseParticipant[];
  expenses: GroupExpenseRow[];
};

function formatMoney(amountStr: string, currencyCode: string): string {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return amountStr;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatAmountForInput(amountStr: string): string {
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return "";
  const cents = Math.round(n * 100);
  if (cents % 100 === 0) return String(Math.floor(cents / 100));
  const frac = cents % 100;
  return `${Math.floor(cents / 100)},${String(frac).padStart(2, "0")}`;
}

function participantNameById(
  participants: GroupExpenseParticipant[],
  id: string,
): string {
  return participants.find((p) => p.id === id)?.display_name ?? "—";
}

export function GroupExpensesSection({
  groupId,
  currency,
  participants,
  expenses,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [rawAmount, setRawAmount] = useState("");
  const [expenseDateIso, setExpenseDateIso] = useState(() => todayIso());
  const [paidById, setPaidById] = useState(() => participants[0]?.id ?? "");
  const [splitOn, setSplitOn] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of participants) initial[p.id] = true;
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** Gasto cuyo detalle (reparto, acciones) se muestra debajo del listado. */
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);

  const orderedParticipantIds = useMemo(
    () =>
      [...participants]
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map((p) => p.id),
    [participants],
  );

  function resetFormForCreate() {
    setEditingId(null);
    setTitle("");
    setRawAmount("");
    setExpenseDateIso(todayIso());
    setPaidById(participants[0]?.id ?? "");
    const next: Record<string, boolean> = {};
    for (const p of participants) next[p.id] = true;
    setSplitOn(next);
    setError(null);
  }

  function loadExpenseForEdit(row: GroupExpenseRow) {
    setDetailExpenseId(null);
    setEditingId(row.id);
    setTitle(row.title);
    setRawAmount(formatAmountForInput(row.amount));
    setExpenseDateIso(toDateInputValue(row.expense_date));
    setPaidById(row.paid_by_participant_id);
    const next: Record<string, boolean> = {};
    for (const p of participants) next[p.id] = false;
    for (const id of row.splitParticipantIds) next[id] = true;
    setSplitOn(next);
    setError(null);
  }

  function splitIdsSelected(): string[] {
    return orderedParticipantIds.filter((id) => splitOn[id]);
  }

  function splitBreakdownForExpense(row: GroupExpenseRow): {
    id: string;
    name: string;
    shareCents: number;
  }[] {
    const selected = new Set(row.splitParticipantIds);
    const ids = orderedParticipantIds.filter((id) => selected.has(id));
    const cents = amountToCents(String(row.amount));
    const shares = splitAmountCentsEvenly(cents, ids);
    return ids.map((id) => ({
      id,
      name: participantNameById(participants, id),
      shareCents: shares.get(id) ?? 0,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const splitParticipantIds = splitIdsSelected();
    const payload = {
      groupId,
      rawTitle: title,
      rawAmount,
      expenseDateIso,
      paidByParticipantId: paidById,
      splitParticipantIds,
    };

    startTransition(async () => {
      const result = editingId
        ? await updateExpenseAction({ ...payload, expenseId: editingId })
        : await createExpenseAction(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      resetFormForCreate();
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("¿Borrar este gasto? No se puede deshacer.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteExpenseAction({ groupId, expenseId: id });
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (editingId === id) resetFormForCreate();
      if (detailExpenseId === id) setDetailExpenseId(null);
    });
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Agregá participantes al grupo para poder cargar gastos.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-8" aria-label="Gastos del grupo">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {editingId ? "Editar gasto" : "Nuevo gasto"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="expense-title" className="text-sm text-muted-foreground">
              Nombre
            </label>
            <input
              id="expense-title"
              name="title"
              maxLength={EXPENSE_TITLE_MAX}
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
              placeholder="Ej. Supermercado"
              required
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="expense-amount" className="text-sm text-muted-foreground">
                Monto ({currency})
              </label>
              <input
                id="expense-amount"
                name="amount"
                inputMode="decimal"
                value={rawAmount}
                onChange={(ev) => setRawAmount(ev.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                placeholder="Ej. 1500 o 1500,50"
                required
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="expense-date" className="text-sm text-muted-foreground">
                Fecha del gasto
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="expense-date"
                  name="date"
                  type="date"
                  value={expenseDateIso}
                  onChange={(ev) => setExpenseDateIso(ev.target.value)}
                  min="2000-01-01"
                  max="2100-12-31"
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                  required
                  autoComplete="off"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setExpenseDateIso(todayIso())}
                  className="shrink-0 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  Hoy
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usá el calendario del sistema (o escribí la fecha). Por defecto es hoy; «Hoy» restablece la fecha
                actual.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="expense-paid-by" className="text-sm text-muted-foreground">
              Pagó
            </label>
            <select
              id="expense-paid-by"
              name="paidBy"
              value={paidById}
              onChange={(ev) => setPaidById(ev.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
              required
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium text-foreground">
              Repartir entre
            </legend>
            <p className="text-xs text-muted-foreground">
              Partes iguales; el último en esta lista absorbe el centavo de diferencia.
            </p>
            <ul className="flex flex-col gap-2">
              {orderedParticipantIds.map((id) => (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!splitOn[id]}
                      onChange={(ev) =>
                        setSplitOn((prev) => ({ ...prev, [id]: ev.target.checked }))
                      }
                      className="size-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span>{participantNameById(participants, id)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {error ? (
            <p className="text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar gasto"}
            </button>
            {editingId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => resetFormForCreate()}
                className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Historial</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay gastos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => {
              const isOpen = detailExpenseId === row.id;
              const breakdown = isOpen ? splitBreakdownForExpense(row) : [];

              return (
                <li key={row.id}>
                  {isOpen ? (
                    <div
                      className="rounded-lg border border-primary bg-primary/5 p-4 text-card-foreground"
                      role="region"
                      aria-label={`Detalle de ${row.title}`}
                    >
                      <div className="flex flex-col gap-1 border-b border-border pb-3">
                        <h3 className="text-base font-semibold text-foreground">{row.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatExpenseDateDdMmYy(row.expense_date)}
                        </p>
                        <p className="text-lg font-semibold tabular-nums text-foreground">
                          {formatMoney(row.amount, currency)}
                        </p>
                        <p className="text-sm text-foreground">
                          Pagó:{" "}
                          <span className="font-medium">
                            {participantNameById(participants, row.paid_by_participant_id)}
                          </span>
                        </p>
                      </div>
                      <div className="pt-3">
                        <p className="text-sm font-medium text-foreground">Reparto</p>
                        {breakdown.length === 0 ? (
                          <p className="mt-1 text-sm text-muted-foreground">Sin reparto.</p>
                        ) : (
                          <ul className="mt-2 flex flex-col gap-2">
                            {breakdown.map((line) => (
                              <li
                                key={line.id}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="text-foreground">{line.name}</span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatMoney((line.shareCents / 100).toFixed(2), currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => loadExpenseForEdit(row)}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(row.id)}
                          className="rounded-md border border-destructive-border bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          Borrar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDetailExpenseId(null)}
                          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setDetailExpenseId(row.id)}
                      aria-expanded={false}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-card-foreground">{row.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {formatExpenseDateDdMmYy(row.expense_date)}
                        </span>
                      </div>
                      <span className="shrink-0 text-lg font-semibold tabular-nums text-card-foreground">
                        {formatMoney(row.amount, currency)}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
