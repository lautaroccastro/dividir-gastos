import { formatParticipantName } from "@/lib/text/format-names";
import { SELF_PARTICIPANT_LABEL } from "@/lib/validation/group-create";

/** Owner-facing label: formatted nickname + «(Tú)». */
export function formatSelfParticipantDisplayName(rawNickname: string): string {
  const formatted = formatParticipantName(rawNickname);
  return `${formatted} (${SELF_PARTICIPANT_LABEL})`;
}
