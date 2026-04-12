/**
 * Greedy settlement: match largest debtor with largest creditor until balances are zero.
 * Deterministic: ties broken by first occurrence in `participantIdsOrdered`.
 */
export type SuggestedTransfer = {
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
};

export function computeSuggestedTransfers(
  netCents: Map<string, number>,
  participantIdsOrdered: string[],
): SuggestedTransfer[] {
  const bal = new Map<string, number>();
  for (const id of participantIdsOrdered) {
    bal.set(id, netCents.get(id) ?? 0);
  }

  const out: SuggestedTransfer[] = [];

  while (true) {
    let minBal = Infinity;
    for (const id of participantIdsOrdered) {
      const c = bal.get(id) ?? 0;
      if (c < minBal) minBal = c;
    }
    if (minBal >= 0) break;

    let debtorId: string | null = null;
    for (const id of participantIdsOrdered) {
      if ((bal.get(id) ?? 0) === minBal) {
        debtorId = id;
        break;
      }
    }
    if (debtorId === null) break;

    let maxBal = -Infinity;
    for (const id of participantIdsOrdered) {
      const c = bal.get(id) ?? 0;
      if (c > maxBal) maxBal = c;
    }
    if (maxBal <= 0) break;

    let creditorId: string | null = null;
    for (const id of participantIdsOrdered) {
      if ((bal.get(id) ?? 0) === maxBal) {
        creditorId = id;
        break;
      }
    }
    if (creditorId === null || debtorId === creditorId) break;

    const d = bal.get(debtorId)!;
    const cr = bal.get(creditorId)!;
    const pay = Math.min(-d, cr);
    if (pay <= 0) break;

    out.push({
      fromParticipantId: debtorId,
      toParticipantId: creditorId,
      amountCents: pay,
    });
    bal.set(debtorId, d + pay);
    bal.set(creditorId, cr - pay);
  }

  return out;
}
