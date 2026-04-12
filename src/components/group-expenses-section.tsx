"use client";

import { setGroupTransfersSuggestedUiAction } from "@/app/actions/group-update";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { computeParticipantNetBalancesCents } from "@/lib/expense/balance";
import { computeSuggestedTransfers } from "@/lib/expense/suggested-transfers";
import { amountToCents, splitAmountCentsEvenly } from "@/lib/expense/split";
import {
  EXPENSE_TITLE_MAX,
  formatExpenseDateDdMmYyyy,
  todayIso,
  toDateInputValue,
} from "@/lib/validation/expense";
import { useGroupTransfersUi } from "@/components/group-transfers-ui-context";
import { TransfersReadonlyNotice } from "@/components/transfers-readonly-notice";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

export type GroupExpenseParticipant = {
  id: string;
  display_name: string;
  sort_order: number;
  payment_alias: string | null;
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

function participantPaymentAliasById(
  participants: GroupExpenseParticipant[],
  id: string,
): string | null {
  const a = participants.find((p) => p.id === id)?.payment_alias;
  if (a == null || !String(a).trim()) return null;
  return String(a).trim();
}

const expenseFormCardClass =
  "rounded-lg border border-primary bg-primary/5 p-4 text-card-foreground";

export function GroupExpensesSection({
  groupId,
  currency,
  participants,
  expenses,
}: Props) {
  const router = useRouter();
  const { transfersViewActive: showTransfersView, setTransfersViewActive } =
    useGroupTransfersUi();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const orderedParticipantIds = useMemo(
    () =>
      [...participants]
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map((p) => p.id),
    [participants],
  );

  const expensesDataFingerprint = useMemo(
    () =>
      JSON.stringify({
        e: expenses.map(
          (row) =>
            `${row.id}|${row.amount}|${row.paid_by_participant_id}|${[...row.splitParticipantIds].sort().join(",")}`,
        ),
        p: orderedParticipantIds.join(","),
      }),
    [expenses, orderedParticipantIds],
  );

  const prevFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevFingerprintRef.current === null) {
      prevFingerprintRef.current = expensesDataFingerprint;
      return;
    }
    if (prevFingerprintRef.current !== expensesDataFingerprint) {
      prevFingerprintRef.current = expensesDataFingerprint;
      setTransfersViewActive(false);
    }
  }, [expensesDataFingerprint, setTransfersViewActive]);

  const suggestedTransfers = useMemo(() => {
    const net = computeParticipantNetBalancesCents(expenses, orderedParticipantIds);
    return computeSuggestedTransfers(net, orderedParticipantIds);
  }, [expenses, orderedParticipantIds]);

  function resetFieldsForNew() {
    setTitle("");
    setRawAmount("");
    setExpenseDateIso(todayIso());
    setPaidById(participants[0]?.id ?? "");
    const next: Record<string, boolean> = {};
    for (const p of participants) next[p.id] = true;
    setSplitOn(next);
  }

  function resetAfterSuccess() {
    setEditingId(null);
    setIsCreating(false);
    resetFieldsForNew();
    setError(null);
  }

  function loadExpenseForEdit(row: GroupExpenseRow) {
    setIsCreating(false);
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
    if (!editingId && !isCreating) return;
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
      if (editingId) {
        const result = await updateExpenseAction({ ...payload, expenseId: editingId });
        if (result?.error) {
          setError(result.error);
          return;
        }
        resetAfterSuccess();
        return;
      }
      if (isCreating) {
        const result = await createExpenseAction(payload);
        if (result?.error) {
          setError(result.error);
          return;
        }
        resetAfterSuccess();
        return;
      }
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
      if (editingId === id) resetAfterSuccess();
    });
  }

  function openCreateForm() {
    setEditingId(null);
    resetFieldsForNew();
    setIsCreating(true);
    setError(null);
  }

  function cancelCreate() {
    setIsCreating(false);
    resetFieldsForNew();
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function openTransfersView() {
    setEditingId(null);
    setIsCreating(false);
    setError(null);
    setTransfersViewActive(true);
    startTransition(async () => {
      const result = await setGroupTransfersSuggestedUiAction({
        groupId,
        value: true,
      });
      if (result?.error) {
        setError(result.error);
        setTransfersViewActive(false);
        return;
      }
      router.refresh();
    });
  }

  function closeTransfersView() {
    setTransfersViewActive(false);
    setError(null);
    startTransition(async () => {
      const result = await setGroupTransfersSuggestedUiAction({
        groupId,
        value: false,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  /** Campos comunes al formulario de alta/edición. */
  function expenseFormFields(prefix: string) {
    return (
      <>
        <div className="flex flex-col gap-3 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${prefix}-title`}
              className="text-sm text-muted-foreground"
            >
              Nombre
            </label>
            <input
              id={`${prefix}-title`}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${prefix}-amount`}
                className="text-sm text-muted-foreground"
              >
                Monto ({currency})
              </label>
              <input
                id={`${prefix}-amount`}
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
              <label
                htmlFor={`${prefix}-date`}
                className="text-sm text-muted-foreground"
              >
                Fecha
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={`${prefix}-date`}
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
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${prefix}-paid`}
              className="text-sm text-muted-foreground"
            >
              Pagó
            </label>
            <select
              id={`${prefix}-paid`}
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
        </div>
        <div className="pt-3">
          <p className="text-sm font-medium text-foreground">Repartir entre</p>
          <ul className="mt-2 flex flex-col gap-2">
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
        </div>
      </>
    );
  }

  if (participants.length === 0) {
    return (
      <section
        className="border-t border-border pt-8"
        aria-label="Gastos del grupo"
      >
        <p className="text-sm text-muted-foreground">
          Agregá participantes al grupo para poder cargar gastos.
        </p>
      </section>
    );
  }

  const expensesReadOnly = showTransfersView;

  return (
    <section
      className="flex flex-col gap-4 border-t border-border pt-8"
      aria-label="Gastos del grupo"
    >
      <h2 className="text-lg font-semibold text-foreground">Historial de pagos</h2>

      {expensesReadOnly ? <TransfersReadonlyNotice /> : null}

      <div
        className={
          expensesReadOnly
            ? "pointer-events-none cursor-not-allowed select-none opacity-60"
            : undefined
        }
      >
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay gastos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => {
            const isEdit = editingId === row.id && !expensesReadOnly;
            const breakdown = splitBreakdownForExpense(row);
            const sharePerPersonStr =
              breakdown.length > 0
                ? formatMoney((breakdown[0]!.shareCents / 100).toFixed(2), currency)
                : "";

            return (
              <li key={row.id}>
                {isEdit ? (
                  <form
                    onSubmit={handleSubmit}
                    className={expenseFormCardClass}
                    aria-label={`Editar ${row.title}`}
                  >
                    {expenseFormFields(`edit-${row.id}`)}
                    {error ? (
                      <p className="mt-3 text-sm text-destructive-foreground" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {pending ? "Guardando…" : "Guardar cambios"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={cancelEdit}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-card-foreground">
                          {row.title}{" "}
                          <span className="font-normal text-muted-foreground">
                            ({participantNameById(participants, row.paid_by_participant_id)})
                          </span>
                        </span>
                      </div>
                      <span className="shrink-0 text-lg font-semibold tabular-nums text-card-foreground">
                        {formatMoney(row.amount, currency)}
                      </span>
                    </div>
                    {breakdown.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Sin reparto.</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {breakdown.length === 1
                            ? `1 participante: ${sharePerPersonStr}`
                            : `${breakdown.length} participantes: ${sharePerPersonStr} cada uno`}
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground marker:text-muted-foreground">
                          {breakdown.map((line) => (
                            <li key={line.id}>{line.name}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <span className="text-sm text-muted-foreground">
                        Pagado el {formatExpenseDateDdMmYyyy(row.expense_date)}
                      </span>
                      <div className="flex shrink-0 gap-4">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => loadExpenseForEdit(row)}
                          className="text-sm text-muted-foreground underline decoration-muted-foreground/70 underline-offset-2 hover:text-foreground disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(row.id)}
                          className="text-sm font-medium text-red-700 underline decoration-red-700 underline-offset-2 hover:text-red-800 dark:text-red-500 dark:decoration-red-500 dark:hover:text-red-400 disabled:opacity-50"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
            })}
          </ul>
        )}
      </div>

      <div
        className={`pt-2 ${
          expensesReadOnly
            ? "pointer-events-none cursor-not-allowed select-none opacity-60"
            : ""
        }`}
      >
        {isCreating && !expensesReadOnly ? (
          <form
            onSubmit={handleSubmit}
            className={expenseFormCardClass}
            aria-label="Nuevo gasto"
          >
            <h3 className="mb-3 text-base font-semibold text-foreground">Nuevo gasto</h3>
            {expenseFormFields("new")}
            {error ? (
              <p className="mt-3 text-sm text-destructive-foreground" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar gasto"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={cancelCreate}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={pending || expensesReadOnly}
            onClick={openCreateForm}
            className="w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Agregar gasto
          </button>
        )}
      </div>

      {showTransfersView ? (
        <div className="flex flex-col gap-4 pt-4">
          <h2 className="text-lg font-semibold text-foreground" id="transferencias-heading">
            Transferencias sugeridas
          </h2>
          <p className="text-sm text-muted-foreground">
            Montos mínimos para saldar balances, según los gastos cargados.
          </p>
          {suggestedTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay transferencias pendientes.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" aria-labelledby="transferencias-heading">
              {suggestedTransfers.map((t, index) => {
                const receiverAlias = participantPaymentAliasById(
                  participants,
                  t.toParticipantId,
                );
                return (
                  <li
                    key={`${t.fromParticipantId}-${t.toParticipantId}-${index}`}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 font-medium text-red-700 dark:text-red-400">
                        {participantNameById(participants, t.fromParticipantId)}
                      </span>
                      <span
                        className="justify-self-center text-muted-foreground"
                        aria-hidden
                      >
                        →
                      </span>
                      <span className="shrink-0 justify-self-center font-semibold tabular-nums text-foreground">
                        {formatMoney((t.amountCents / 100).toFixed(2), currency)}
                      </span>
                      <span
                        className="justify-self-center text-muted-foreground"
                        aria-hidden
                      >
                        →
                      </span>
                      <div className="min-w-0 justify-self-end text-right">
                        <span className="block font-medium text-green-700 dark:text-green-500">
                          {participantNameById(participants, t.toParticipantId)}
                        </span>
                        {receiverAlias ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Alias: {receiverAlias}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                closeTransfersView();
              }}
              className="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              Volver a editar
            </button>
            <p className="text-xs text-muted-foreground">
              Si modificás gastos o participantes, las sugerencias dejan de mostrarse hasta
              que vuelvas a usar «Cerrar gastos y sugerir transferencias». Al generarlas de
              nuevo, se recalculan con los datos actuales.
            </p>
          </div>
        </div>
      ) : (
        <div className="pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={openTransfersView}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Cerrar gastos y sugerir transferencias
          </button>
        </div>
      )}
    </section>
  );
}
