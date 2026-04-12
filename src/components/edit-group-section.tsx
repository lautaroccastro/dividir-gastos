"use client";

import { updateGroupAction } from "@/app/actions/group-update";
import { formatParticipantName } from "@/lib/text/format-names";
import {
  GROUP_NAME_MAX,
  PARTICIPANT_NAME_MAX,
  PARTICIPANTS_MAX,
  SELF_PARTICIPANT_LABEL,
  type CurrencyCode,
} from "@/lib/validation/group-create";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LocalParticipant = {
  localKey: string;
  serverId?: string;
  displayName: string;
  isSelf: boolean;
};

type InitialParticipant = {
  id: string;
  display_name: string;
  is_self: boolean;
};

type Props = {
  groupId: string;
  initialName: string;
  initialCurrency: CurrencyCode;
  initialParticipants: InitialParticipant[];
};

function caseInsensitiveKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

export function EditGroupSection({
  groupId,
  initialName,
  initialCurrency,
  initialParticipants,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState(initialName);
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [participants, setParticipants] = useState<LocalParticipant[]>(() =>
    initialParticipants.map((p) => ({
      localKey: p.id,
      serverId: p.id,
      displayName: p.display_name,
      isSelf: p.is_self,
    })),
  );
  const [addDraft, setAddDraft] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const userIsIncludedAsParticipant = participants.some((p) => p.isSelf);

  function setUserIncludedAsParticipant(include: boolean) {
    setError(null);
    if (include) {
      setParticipants((previous) =>
        previous.some((p) => p.isSelf)
          ? previous
          : [
              {
                localKey: crypto.randomUUID(),
                displayName: SELF_PARTICIPANT_LABEL,
                isSelf: true,
              },
              ...previous,
            ],
      );
    } else {
      setParticipants((previous) => previous.filter((p) => !p.isSelf));
    }
  }

  function duplicateInList(name: string, excludeLocalKey?: string): boolean {
    const candidateKey = caseInsensitiveKey(name);
    if (!candidateKey) return false;
    return participants.some(
      (participant) =>
        participant.localKey !== excludeLocalKey &&
        caseInsensitiveKey(
          participant.isSelf ? SELF_PARTICIPANT_LABEL : participant.displayName,
        ) === candidateKey,
    );
  }

  function handleAddParticipant() {
    setError(null);
    const trimmed = addDraft.trim();
    if (!trimmed) {
      setError("Escribí un nombre antes de agregar.");
      return;
    }
    if (trimmed.length > PARTICIPANT_NAME_MAX) {
      setError(`Cada nombre no puede superar ${PARTICIPANT_NAME_MAX} caracteres.`);
      return;
    }
    const formatted = formatParticipantName(trimmed);
    if (duplicateInList(formatted)) {
      setError("Ese nombre ya está en la lista.");
      return;
    }
    if (participants.length >= PARTICIPANTS_MAX) {
      setError(`Como máximo ${PARTICIPANTS_MAX} participantes.`);
      return;
    }
    setParticipants((previous) => [
      ...previous,
      {
        localKey: crypto.randomUUID(),
        displayName: formatted,
        isSelf: false,
      },
    ]);
    setAddDraft("");
  }

  function handleRemove(localKey: string) {
    const target = participants.find((p) => p.localKey === localKey);
    if (target?.isSelf) return;
    setError(null);
    setParticipants((previous) => previous.filter((p) => p.localKey !== localKey));
    if (editingKey === localKey) setEditingKey(null);
  }

  function startEdit(participant: LocalParticipant) {
    if (participant.isSelf) return;
    setEditingKey(participant.localKey);
    setEditDraft(participant.displayName);
  }

  function saveEdit() {
    if (!editingKey) return;
    setError(null);
    const trimmed = editDraft.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (trimmed.length > PARTICIPANT_NAME_MAX) {
      setError(`Cada nombre no puede superar ${PARTICIPANT_NAME_MAX} caracteres.`);
      return;
    }
    const formatted = formatParticipantName(trimmed);
    if (duplicateInList(formatted, editingKey)) {
      setError("Ese nombre ya está en la lista.");
      return;
    }
    setParticipants((previous) =>
      previous.map((p) =>
        p.localKey === editingKey ? { ...p, displayName: formatted } : p,
      ),
    );
    setEditingKey(null);
  }

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setGroupName(initialName);
        setCurrency(initialCurrency);
        setParticipants(
          initialParticipants.map((p) => ({
            localKey: p.id,
            serverId: p.id,
            displayName: p.display_name,
            isSelf: p.is_self,
          })),
        );
        setAddDraft("");
        setEditingKey(null);
      }
      setError(null);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (participants.length < 1) {
      setError("Tiene que haber al menos un participante.");
      return;
    }
    startTransition(async () => {
      const result = await updateGroupAction({
        groupId,
        rawGroupName: groupName,
        currency,
        participants: participants.map((p) => ({
          serverId: p.serverId,
          displayName: p.displayName,
          isSelf: p.isSelf,
        })),
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label="Editar grupo">
      <button
        type="button"
        onClick={() => toggleOpen()}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-foreground">Datos del grupo</span>
        <span className="text-sm text-muted-foreground">{open ? "Ocultar" : "Editar"}</span>
      </button>

      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 border-t border-border pt-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor="edit-group-name" className="text-sm font-medium text-foreground">
              Nombre del grupo
            </label>
            <input
              id="edit-group-name"
              type="text"
              maxLength={GROUP_NAME_MAX}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Máximo {GROUP_NAME_MAX} caracteres. No puede repetirse con tus otros grupos (ignorando
              mayúsculas).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Moneda</span>
            <p className="text-xs text-muted-foreground">
              Todos los gastos de este grupo usan esta moneda.
            </p>
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="ARS">ARS — Peso argentino</option>
              <option value="USD">USD — Dólar estadounidense</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground" id="edit-include-self-label">
                  Formo parte de los participantes
                </span>
                <p className="text-xs text-muted-foreground">
                  Los participantes nuevos no se agregan automáticamente al reparto de gastos ya
                  cargados.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={userIsIncludedAsParticipant}
                aria-labelledby="edit-include-self-label"
                onClick={() => setUserIncludedAsParticipant(!userIsIncludedAsParticipant)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  userIsIncludedAsParticipant ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 block h-6 w-6 rounded-full bg-background shadow transition-transform ${
                    userIsIncludedAsParticipant ? "translate-x-6" : "translate-x-0"
                  }`}
                  aria-hidden
                />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Participantes</span>
            <ul className="flex flex-col gap-2">
              {participants.map((participant) => (
                <li
                  key={participant.localKey}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  {participant.isSelf ? (
                    <span className="flex-1 font-medium text-foreground">{SELF_PARTICIPANT_LABEL}</span>
                  ) : editingKey === participant.localKey ? (
                    <>
                      <input
                        type="text"
                        maxLength={PARTICIPANT_NAME_MAX}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button type="button" onClick={() => void saveEdit()} className="text-sm text-primary">
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="text-sm text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-foreground">{participant.displayName}</span>
                      <button
                        type="button"
                        onClick={() => startEdit(participant)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Editar
                      </button>
                    </>
                  )}
                  {participant.isSelf ? null : (
                    <button
                      type="button"
                      onClick={() => handleRemove(participant.localKey)}
                      className="text-sm text-muted-foreground hover:text-destructive-foreground"
                    >
                      Quitar
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {participants.length < PARTICIPANTS_MAX ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label htmlFor="edit-add-participant" className="text-xs text-muted-foreground">
                    Agregar persona
                  </label>
                  <input
                    id="edit-add-participant"
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
                  onClick={handleAddParticipant}
                  className="h-10 shrink-0 rounded-lg border border-border bg-muted px-4 text-sm font-medium text-foreground hover:opacity-90"
                >
                  Agregar
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Llegaste al máximo de {PARTICIPANTS_MAX} participantes.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending || participants.length < 1}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setGroupName(initialName);
                setCurrency(initialCurrency);
                setParticipants(
                  initialParticipants.map((p) => ({
                    localKey: p.id,
                    serverId: p.id,
                    displayName: p.display_name,
                    isSelf: p.is_self,
                  })),
                );
                setAddDraft("");
                setEditingKey(null);
                setError(null);
              }}
              className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm text-foreground hover:bg-muted"
            >
              Descartar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
