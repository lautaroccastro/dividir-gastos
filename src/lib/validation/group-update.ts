import {
  formatGroupName,
  formatParticipantName,
} from "@/lib/text/format-names";
import {
  GROUP_NAME_MAX,
  normalizeCurrency,
  PARTICIPANT_NAME_MAX,
  PARTICIPANTS_MAX,
  SELF_PARTICIPANT_LABEL,
  validateParticipantListUniqueness,
  validateRawGroupName,
  validateRawParticipantName,
  type CurrencyCode,
} from "@/lib/validation/group-create";

export type UpdateParticipantInput = {
  /** Set for rows already persisted; omit for newly added participants. */
  serverId?: string;
  displayName: string;
  isSelf: boolean;
};

export type UpdateGroupPayloadInput = {
  rawGroupName: string;
  currency: string;
  participants: UpdateParticipantInput[];
};

export type BuiltUpdateParticipantRow = {
  serverId?: string;
  displayName: string;
  isSelf: boolean;
  sortOrder: number;
};

export type BuildUpdateGroupPayloadResult =
  | {
      ok: true;
      groupName: string;
      currency: CurrencyCode;
      rows: BuiltUpdateParticipantRow[];
    }
  | { ok: false; error: string };

/**
 * Validates group edit payload (name, currency, participants with optional server ids).
 */
export function buildUpdateGroupPayload(
  input: UpdateGroupPayloadInput,
): BuildUpdateGroupPayloadResult {
  const nameErr = validateRawGroupName(input.rawGroupName);
  if (nameErr) return { ok: false, error: nameErr };

  const currency = normalizeCurrency(input.currency);
  if (!currency) return { ok: false, error: "Moneda inválida." };

  const formattedGroupName = formatGroupName(input.rawGroupName);

  if (input.participants.length < 1) {
    return { ok: false, error: "Tiene que haber al menos un participante." };
  }
  if (input.participants.length > PARTICIPANTS_MAX) {
    return { ok: false, error: `Como máximo ${PARTICIPANTS_MAX} participantes.` };
  }

  const selfCount = input.participants.filter((p) => p.isSelf).length;
  if (selfCount > 1) {
    return { ok: false, error: 'Solo puede haber un participante marcado como "Tú".' };
  }

  const rows: BuiltUpdateParticipantRow[] = [];
  const namesForUniqueness: string[] = [];

  for (let i = 0; i < input.participants.length; i++) {
    const p = input.participants[i]!;
    const rawName = p.isSelf ? SELF_PARTICIPANT_LABEL : p.displayName;
    const nameErrP = validateRawParticipantName(rawName);
    if (nameErrP) return { ok: false, error: nameErrP };

    const displayName = p.isSelf
      ? SELF_PARTICIPANT_LABEL
      : formatParticipantName(p.displayName);

    rows.push({
      serverId: p.serverId,
      displayName,
      isSelf: p.isSelf,
      sortOrder: i,
    });
    namesForUniqueness.push(displayName);
  }

  const uniqErr = validateParticipantListUniqueness(namesForUniqueness);
  if (uniqErr) return { ok: false, error: uniqErr };

  return { ok: true, groupName: formattedGroupName, currency, rows };
}
