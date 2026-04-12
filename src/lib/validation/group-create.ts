import {
  formatGroupName,
  formatParticipantName,
} from "@/lib/text/format-names";

export const GROUP_NAME_MAX = 50;
export const PARTICIPANT_NAME_MAX = 25;
/** Optional free-text alias for how this participant receives money (CBU, alias MP, etc.). */
export const PARTICIPANT_PAYMENT_ALIAS_MAX = 50;
export const PARTICIPANTS_MAX = 50;
export const CURRENCIES = ["ARS", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Display label for the participant row that represents the current user. */
export const SELF_PARTICIPANT_LABEL = "Tú" as const;

export type ParticipantInput = {
  displayName: string;
  isSelf: boolean;
};

function caseInsensitiveKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/** Validates raw group name before formatting. */
export function validateRawGroupName(raw: string): string | null {
  const trimmedGroupName = raw.trim();
  if (!trimmedGroupName) {
    return "El nombre del grupo es obligatorio.";
  }
  if (trimmedGroupName.length > GROUP_NAME_MAX) {
    return `El nombre del grupo no puede superar ${GROUP_NAME_MAX} caracteres.`;
  }
  return null;
}

/** Validates a single raw participant name (before formatting), excluding empty adds. */
export function validateRawParticipantName(raw: string): string | null {
  const trimmedParticipantName = raw.trim();
  if (!trimmedParticipantName) {
    return "El nombre no puede estar vacío.";
  }
  if (trimmedParticipantName.length > PARTICIPANT_NAME_MAX) {
    return `Cada nombre no puede superar ${PARTICIPANT_NAME_MAX} caracteres.`;
  }
  return null;
}

/** Validates optional payment alias; empty after trim is allowed (clears the field). */
export function validateRawPaymentAlias(raw: string): string | null {
  const t = raw.trim();
  if (t.length > PARTICIPANT_PAYMENT_ALIAS_MAX) {
    return `El alias no puede superar ${PARTICIPANT_PAYMENT_ALIAS_MAX} caracteres.`;
  }
  return null;
}

/** Stored value: null when empty / whitespace-only. */
export function normalizePaymentAlias(raw: string): string | null {
  const t = raw.trim();
  return t.length ? t : null;
}

/**
 * Returns an error message if the participant list is invalid, else null.
 * Expects non-empty trimmed names (callers format with formatParticipantName / fixed self label).
 */
export function validateParticipantListUniqueness(
  formattedNames: string[],
): string | null {
  if (formattedNames.length < 1) {
    return "Tiene que haber al menos un participante.";
  }
  if (formattedNames.length > PARTICIPANTS_MAX) {
    return `Como máximo ${PARTICIPANTS_MAX} participantes.`;
  }
  const seenCaseInsensitiveKeys = new Set<string>();
  for (const name of formattedNames) {
    const duplicateKey = caseInsensitiveKey(name);
    if (seenCaseInsensitiveKeys.has(duplicateKey)) {
      return "No puede haber dos participantes con el mismo nombre (ignorando mayúsculas).";
    }
    seenCaseInsensitiveKeys.add(duplicateKey);
  }
  return null;
}

/**
 * Whitelist for currency (fixed options, not free text — UI must use a select).
 * Call on the server so requests cannot inject arbitrary strings into `groups.currency`.
 */
export function normalizeCurrency(raw: string): CurrencyCode | null {
  if (raw === "ARS" || raw === "USD") return raw;
  return null;
}

/**
 * Builds formatted group name and participant rows for persistence.
 * `validateRawGroupName` already rejects empty / whitespace-only names, so `formatGroupName`
 * will not return an empty string for valid input (kept as a single source of truth for "empty").
 */
export function buildCreatePayload(input: {
  rawGroupName: string;
  /** Must be one of ARS | USD (validated via `normalizeCurrency`). */
  currency: string;
  participants: ParticipantInput[];
}):
  | {
      ok: true;
      groupName: string;
      currency: CurrencyCode;
      rows: { displayName: string; isSelf: boolean; sortOrder: number }[];
    }
  | { ok: false; error: string } {
  const rawGroupNameError = validateRawGroupName(input.rawGroupName);
  if (rawGroupNameError) {
    return { ok: false, error: rawGroupNameError };
  }

  const normalizedCurrency = normalizeCurrency(input.currency);
  if (!normalizedCurrency) {
    return { ok: false, error: "Moneda inválida." };
  }

  const formattedGroupName = formatGroupName(input.rawGroupName);

  const participantRows: {
    displayName: string;
    isSelf: boolean;
    sortOrder: number;
  }[] = [];
  const formattedNamesForUniquenessCheck: string[] = [];

  for (
    let participantIndex = 0;
    participantIndex < input.participants.length;
    participantIndex += 1
  ) {
    const participantInput = input.participants[participantIndex];

    const rawNameForValidation = participantInput.isSelf
      ? SELF_PARTICIPANT_LABEL
      : participantInput.displayName;

    const participantNameValidationError =
      validateRawParticipantName(rawNameForValidation);
    if (participantNameValidationError) {
      return { ok: false, error: participantNameValidationError };
    }

    const formattedParticipantName = participantInput.isSelf
      ? SELF_PARTICIPANT_LABEL
      : formatParticipantName(participantInput.displayName);

    participantRows.push({
      displayName: formattedParticipantName,
      isSelf: participantInput.isSelf,
      sortOrder: participantIndex,
    });
    formattedNamesForUniquenessCheck.push(formattedParticipantName);
  }

  const participantListUniquenessError = validateParticipantListUniqueness(
    formattedNamesForUniquenessCheck,
  );
  if (participantListUniquenessError) {
    return { ok: false, error: participantListUniquenessError };
  }

  return {
    ok: true,
    groupName: formattedGroupName,
    currency: normalizedCurrency,
    rows: participantRows,
  };
}
