import { amountToCents, splitAmountCentsEvenly } from "./split";

export type ExpenseForBalance = {
  amount: string;
  paid_by_participant_id: string;
  splitParticipantIds: string[];
};

/**
 * Net balance per participant in cents: + = the group owes them, − = they owe the group.
 * Uses the same split order as the UI (participants sorted by `participantIdsOrdered`).
 */
export function computeParticipantNetBalancesCents(
  expenses: ExpenseForBalance[],
  participantIdsOrdered: string[],
): Map<string, number> {
  const net = new Map<string, number>();
  for (const id of participantIdsOrdered) {
    net.set(id, 0);
  }

  for (const exp of expenses) {
    const totalCents = amountToCents(String(exp.amount));
    if (totalCents <= 0) continue;

    const splitSet = new Set(exp.splitParticipantIds);
    const orderedSplit = participantIdsOrdered.filter((id) => splitSet.has(id));
    const shares = splitAmountCentsEvenly(totalCents, orderedSplit);

    const payerId = exp.paid_by_participant_id;
    net.set(payerId, (net.get(payerId) ?? 0) + totalCents);

    for (const id of orderedSplit) {
      const share = shares.get(id) ?? 0;
      net.set(id, (net.get(id) ?? 0) - share);
    }
  }

  return net;
}
