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
  todayDdMmYy,
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
  const [rawDate, setRawDate] = useState(todayDdMmYy());
  const [paidById, setPaidById] = useState(() => participants[0]?.id ?? "");
  const [splitOn, setSplitOn] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of participants) initial[p.id] = true;
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    setRawDate(todayDdMmYy());
    setPaidById(participants[0]?.id ?? "");
    const next: Record<string, boolean> = {};
    for (const p of participants) next[p.id] = true;
    setSplitOn(next);
    setError(null);
  }

  function loadExpenseForEdit(row: GroupExpenseRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setRawAmount(formatAmountForInput(row.amount));
    setRawDate(formatExpenseDateDdMmYy(row.expense_date));
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

  function splitSummaryLine(row: GroupExpenseRow): string {
    const selected = new Set(row.splitParticipantIds);
    const ids = orderedParticipantIds.filter((id) => selected.has(id));
    const cents = amountToCents(String(row.amount));
    const shares = splitAmountCentsEvenly(cents, ids);
    if (ids.length === 0) return "Sin reparto";
    const fmt = (c: number) => formatMoney((c / 100).toFixed(2), currency);
    const values = ids.map((id) => shares.get(id) ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return `${ids.length} partes iguales · ${fmt(min)} c/u`;
    }
    return `${ids.length} partes · ${fmt(min)} a ${fmt(max)} (el último ajusta)`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const splitParticipantIds = splitIdsSelected();
    const payload = {
      groupId,
      rawTitle: title,
      rawAmount,
      rawDateDdMmYy: rawDate,
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
              <div className="flex gap-2">
                <input
                  id="expense-date"
                  name="date"
                  value={rawDate}
                  onChange={(ev) => setRawDate(ev.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                  placeholder="DD-MM-YY"
                  required
                  autoComplete="off"
                  title="Día-mes-año con dos cifras. Ej: 07-04-26"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setRawDate(todayDdMmYy())}
                  className="shrink-0 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  Hoy
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Formato <span className="font-mono text-foreground">DD-MM-YY</span>. Por defecto es la fecha de
                hoy; tocá «Hoy» para volver a hoy después de editarla.
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
          <ul className="flex flex-col gap-3">
            {expenses.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{row.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatExpenseDateDdMmYy(row.expense_date)} · Pagó{" "}
                      {participantNameById(participants, row.paid_by_participant_id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {splitSummaryLine(row)}
                    </span>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatMoney(row.amount, currency)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => loadExpenseForEdit(row)}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(row.id)}
                    className="text-sm text-destructive-foreground hover:underline disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
