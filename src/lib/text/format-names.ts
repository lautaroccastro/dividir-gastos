/**
 * Display formatting for group titles and participant labels.
 * Rules are product-specific (see DESIGN / product spec).
 */

/**
 * Group title: uppercase only the first character of the entire string;
 * all other characters stay exactly as the user typed.
 */
export function formatGroupName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

/**
 * Participant label: uppercase only the first character of each whitespace-separated word;
 * the rest of each word stays exactly as the user typed.
 */
export function formatParticipantName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed
    .split(" ")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
