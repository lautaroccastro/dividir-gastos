"use client";

import {
  addParticipantAction,
  deleteParticipantAction,
  updateGroupNameAction,
  updateParticipantNameAction,
} from "@/app/actions/group-update";
import {
  GROUP_NAME_MAX,
  PARTICIPANT_NAME_MAX,
  PARTICIPANTS_MAX,
  SELF_PARTICIPANT_LABEL,
  type CurrencyCode,
} from "@/lib/validation/group-create";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatNetBalanceMoney(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(cents / 100);
}

function netBalanceColorClass(cents: number): string {
  if (cents > 0) return "text-green-600 dark:text-green-500";
  if (cents < 0) return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}

type ParticipantRow = {
  id: string;
  display_name: string;
  is_self: boolean;
};

type Props = {
  groupId: string;
  initialName: string;
  initialCurrency: CurrencyCode;
  initialParticipants: ParticipantRow[];
  initialNetBalanceCentsByParticipantId: Record<string, number>;
};

export function GroupDetailMeta({
  groupId,
  initialName,
  initialCurrency,
  initialParticipants,
  initialNetBalanceCentsByParticipantId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialName);

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [participantNameDraft, setParticipantNameDraft] = useState("");
  const [addDraft, setAddDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateGroupNameAction({
        groupId,
        rawGroupName: nameDraft,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditingName(false);
      refresh();
    });
  }

  function startEditParticipant(p: ParticipantRow) {
    if (p.is_self) return;
    setEditingParticipantId(p.id);
    setParticipantNameDraft(p.display_name);
    setError(null);
  }

  function submitParticipantName(e: React.FormEvent) {
    e.preventDefault();
    if (!editingParticipantId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateParticipantNameAction({
        groupId,
        participantId: editingParticipantId,
        rawDisplayName: participantNameDraft,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditingParticipantId(null);
      refresh();
    });
  }

  function handleDeleteParticipant(p: ParticipantRow) {
    if (
      !window.confirm(
        `¿Quitar a «${p.is_self ? SELF_PARTICIPANT_LABEL : p.display_name}» del grupo?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteParticipantAction({
        groupId,
        participantId: p.id,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  function handleAddParticipant() {
    setError(null);
    const trimmed = addDraft.trim();
    if (!trimmed) {
      setError("Escribí un nombre antes de agregar.");
      return;
    }
    startTransition(async () => {
      const result = await addParticipantAction({
        groupId,
        rawDisplayName: trimmed,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAddDraft("");
      refresh();
    });
  }

  const atParticipantLimit = initialParticipants.length >= PARTICIPANTS_MAX;

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-col gap-2">
          {editingName ? (
            <form
              onSubmit={submitName}
              className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <input
                type="text"
                maxLength={GROUP_NAME_MAX}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xl font-semibold text-foreground"
                autoFocus
                required
                aria-label="Nombre del grupo"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setNameDraft(initialName);
                    setEditingName(false);
                    setError(null);
                  }}
                  className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold text-foreground">{initialName}</h1>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setNameDraft(initialName);
                  setEditingName(true);
                  setError(null);
                }}
                className="text-xs text-muted-foreground underline decoration-muted-foreground/80 underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                Editar
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Moneda: <span className="text-foreground">{initialCurrency}</span>
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-label="Participantes">
        <h2 className="text-lg font-semibold text-foreground">Participantes</h2>
        <p className="text-xs text-muted-foreground">
          Los participantes nuevos no se agregan solos al reparto de gastos ya cargados.
        </p>
        <ul className="flex flex-col gap-2">
          {initialParticipants.map((p) => {
            const netCents = initialNetBalanceCentsByParticipantId[p.id] ?? 0;
            const balanceEl = (
              <span
                className={`text-sm font-semibold tabular-nums ${netBalanceColorClass(netCents)}`}
                title="Balance neto: lo que te deben menos lo que debés"
              >
                ({formatNetBalanceMoney(netCents, initialCurrency)})
              </span>
            );

            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                {p.is_self ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5">
                      <span className="min-w-0 font-medium text-card-foreground">
                        {SELF_PARTICIPANT_LABEL}
                      </span>
                      {balanceEl}
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDeleteParticipant(p)}
                      className="text-sm text-destructive-foreground hover:underline disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </>
                ) : editingParticipantId === p.id ? (
                  <>
                    <form
                      onSubmit={submitParticipantName}
                      className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2"
                    >
                      <input
                        type="text"
                        maxLength={PARTICIPANT_NAME_MAX}
                        value={participantNameDraft}
                        onChange={(e) => setParticipantNameDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                        autoFocus
                        required
                        aria-label="Nombre del participante"
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className="text-sm font-medium text-primary disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setEditingParticipantId(null);
                          setError(null);
                        }}
                        className="text-sm text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDeleteParticipant(p)}
                      className="text-sm text-destructive-foreground hover:underline disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5">
                      <span className="min-w-0 text-card-foreground">{p.display_name}</span>
                      {balanceEl}
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startEditParticipant(p)}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDeleteParticipant(p)}
                      className="text-sm text-destructive-foreground hover:underline disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {atParticipantLimit ? (
          <p className="text-xs text-muted-foreground">
            Llegaste al máximo de {PARTICIPANTS_MAX} participantes.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="add-participant" className="text-xs text-muted-foreground">
                Nuevo participante
              </label>
              <input
                id="add-participant"
                type="text"
                maxLength={PARTICIPANT_NAME_MAX}
                value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddParticipant();
                  }
                }}
                placeholder="Nombre"
                className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={handleAddParticipant}
              className="h-10 shrink-0 rounded-lg border border-dashed border-border bg-muted/30 px-4 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
            >
              Agregar participante
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
