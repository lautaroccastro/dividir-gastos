/**
 * Equal split in cents: `participantIdsOrdered` must be the share order (e.g. by sort_order).
 * The last id absorbs the remainder so the parts sum exactly to `totalCents`.
 */
export function splitAmountCentsEvenly(
  totalCents: number,
  participantIdsOrdered: string[],
): Map<string, number> {
  const n = participantIdsOrdered.length;
  const out = new Map<string, number>();
  if (n <= 0 || totalCents <= 0) {
    return out;
  }
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  for (let i = 0; i < n; i++) {
    const id = participantIdsOrdered[i]!;
    const extra = i === n - 1 ? remainder : 0;
    out.set(id, base + extra);
  }
  return out;
}

export function amountToCents(amountStr: string): number {
  const normalized = amountStr.replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
