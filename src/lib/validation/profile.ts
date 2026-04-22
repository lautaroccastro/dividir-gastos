import { formatParticipantName } from "@/lib/text/format-names";
import { validateRawParticipantName } from "@/lib/validation/group-create";

/** Same rules as a group participant display name. */
export function validateRawProfileNickname(raw: string): string | null {
  return validateRawParticipantName(raw);
}

export function formatStoredProfileNickname(raw: string): string {
  return formatParticipantName(raw);
}
