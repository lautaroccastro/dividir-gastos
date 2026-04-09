"use client";

import { createGroupAction } from "@/app/actions/groups";
import { formatParticipantName } from "@/lib/text/format-names";
import {
  GROUP_NAME_MAX,
  PARTICIPANT_NAME_MAX,
  PARTICIPANTS_MAX,
  SELF_PARTICIPANT_LABEL,
  type CurrencyCode,
} from "@/lib/validation/group-create";
import Link from "next/link";
import { useState, useTransition } from "react";

type LocalParticipant = {
  localKey: string;
  displayName: string;
  isSelf: boolean;
};

function caseInsensitiveKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/**
 * Create-group flow: participant list (pattern A) + single "add" field at the bottom.
 * The self row shows {@link SELF_PARTICIPANT_LABEL} ("Tú"), fixed label, removable, not editable.
 *
 * Group name: free text in the field; formatting is applied on the server and shown after
 * redirect to the group detail page.
 *
 * Participant names: formatted only when confirmed (Add / Enter, or Save in edit mode),
 * using the same helpers as the server (`formatParticipantName`).
 */
export function CreateGroupForm() {
  const [groupName, setGroupName] = useState("");
  /** Only ARS or USD — fixed options from `<select>`, not user-typed text. */
  const [currency, setCurrency] = useState<CurrencyCode>("ARS");
  const [participants, setParticipants] = useState<LocalParticipant[]>(() => [
    {
      localKey: crypto.randomUUID(),
      displayName: SELF_PARTICIPANT_LABEL,
      isSelf: true,
    },
  ]);
  const [addDraft, setAddDraft] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    const trimmedAddDraft = addDraft.trim();
    if (!trimmedAddDraft) {
      setError("Escribí un nombre antes de agregar.");
      return;
    }
    if (trimmedAddDraft.length > PARTICIPANT_NAME_MAX) {
      setError(`Cada nombre no puede superar ${PARTICIPANT_NAME_MAX} caracteres.`);
      return;
    }
    const formattedParticipantName = formatParticipantName(trimmedAddDraft);
    if (duplicateInList(formattedParticipantName)) {
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
        displayName: formattedParticipantName,
        isSelf: false,
      },
    ]);
    setAddDraft("");
  }

  function handleRemove(localKey: string) {
    setError(null);
    setParticipants((previous) =>
      previous.filter((participant) => participant.localKey !== localKey),
    );
    if (editingKey === localKey) {
      setEditingKey(null);
    }
  }

  function startEdit(participant: LocalParticipant) {
    if (participant.isSelf) return;
    setEditingKey(participant.localKey);
    setEditDraft(participant.displayName);
  }

  function saveEdit() {
    if (!editingKey) return;
    setError(null);
    const trimmedEditDraft = editDraft.trim();
    if (!trimmedEditDraft) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (trimmedEditDraft.length > PARTICIPANT_NAME_MAX) {
      setError(`Cada nombre no puede superar ${PARTICIPANT_NAME_MAX} caracteres.`);
      return;
    }
    const formattedParticipantName = formatParticipantName(trimmedEditDraft);
    if (duplicateInList(formattedParticipantName, editingKey)) {
      setError("Ese nombre ya está en la lista.");
      return;
    }
    setParticipants((previous) =>
      previous.map((participant) =>
        participant.localKey === editingKey
          ? { ...participant, displayName: formattedParticipantName }
          : participant,
      ),
    );
    setEditingKey(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (participants.length < 1) {
      setError("Tiene que haber al menos un participante.");
      return;
    }
    startTransition(async () => {
      const result = await createGroupAction({
        rawGroupName: groupName,
        currency,
        participants: participants.map((participant) => ({
          displayName: participant.displayName,
          isSelf: participant.isSelf,
        })),
      });
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="groupName" className="text-sm font-medium text-foreground">
          Nombre del grupo
        </label>
        <input
          id="groupName"
          type="text"
          maxLength={GROUP_NAME_MAX}
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Máximo {GROUP_NAME_MAX} caracteres. No puede repetirse con tus otros grupos
          (ignorando mayúsculas).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Moneda</span>
        <p className="text-xs text-muted-foreground">
          Todos los gastos de este grupo usarán esta moneda.
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

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-foreground">Participantes</span>
        <ul className="flex flex-col gap-2">
          {participants.map((participant) => (
            <li
              key={participant.localKey}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              {participant.isSelf ? (
                <span className="flex-1 font-medium text-card-foreground">
                  {SELF_PARTICIPANT_LABEL}
                </span>
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
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    className="text-sm text-primary"
                  >
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
                  <span className="flex-1 text-card-foreground">
                    {participant.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(participant)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                    aria-label="Editar participante"
                  >
                    Editar
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleRemove(participant.localKey)}
                className="text-sm text-muted-foreground hover:text-destructive-foreground"
                aria-label="Quitar participante"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>

        {participants.length < PARTICIPANTS_MAX ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="addParticipant" className="text-xs text-muted-foreground">
                Agregar persona
              </label>
              <input
                id="addParticipant"
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
          {pending ? "Creando…" : "Crear grupo"}
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm text-foreground hover:bg-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
