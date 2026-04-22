import { DeleteGroupButton } from "@/components/delete-group-button";
import { GroupDetailMeta } from "@/components/group-detail-meta";
import {
  GroupExpensesSection,
  type GroupExpenseRow,
} from "@/components/group-expenses-section";
import { GroupTransfersUiProvider } from "@/components/group-transfers-ui-context";
import { computeParticipantNetBalancesCents } from "@/lib/expense/balance";
import { formatSelfParticipantDisplayName } from "@/lib/text/self-participant-display";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

type ExpenseSplitRow = { participant_id: string };

type ExpenseQueryRow = {
  id: string;
  title: string;
  amount: string | number;
  expense_date: string;
  paid_by_participant_id: string;
  expense_split_participants: ExpenseSplitRow[] | null;
};

/**
 * Group detail: expenses (equal split, payer may be excluded from split).
 */
export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, currency, created_at, transfers_suggested_ui")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !group) {
    notFound();
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, sort_order, is_self, payment_alias")
    .eq("group_id", id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Mis grupos
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground"
        >
          No pudimos cargar tu perfil ({profileError.message}). Probá de nuevo
          más tarde o revisá la configuración del proyecto.
        </div>
        <Link
          href="/cuenta"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ir a Cuenta
        </Link>
      </div>
    );
  }

  const nickname = profile?.nickname?.trim();
  if (!nickname) {
    redirect("/onboarding");
  }

  const selfParticipantDisplayName =
    formatSelfParticipantDisplayName(nickname);

  const participantsForExpenses =
    participants?.map((p) => ({
      id: p.id,
      display_name: p.is_self ? selfParticipantDisplayName : p.display_name,
      sort_order: p.sort_order,
      payment_alias: p.payment_alias as string | null,
    })) ?? [];

  const { data: expensesRaw } = await supabase
    .from("expenses")
    .select(
      `
      id,
      title,
      amount,
      expense_date,
      paid_by_participant_id,
      expense_split_participants ( participant_id )
    `,
    )
    .eq("group_id", id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const expenses: GroupExpenseRow[] = (expensesRaw as ExpenseQueryRow[] | null)?.map(
    (row) => ({
      id: row.id,
      title: row.title,
      amount: String(row.amount),
      expense_date: row.expense_date,
      paid_by_participant_id: row.paid_by_participant_id,
      splitParticipantIds: (row.expense_split_participants ?? []).map(
        (s) => s.participant_id,
      ),
    }),
  ) ?? [];

  const participantIdsOrdered = (participants ?? []).map((p) => p.id);
  const netBalanceCentsByParticipantId = Object.fromEntries(
    computeParticipantNetBalancesCents(expenses, participantIdsOrdered),
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Mis grupos
      </Link>
      <GroupTransfersUiProvider
        initialTransfersSuggestedUi={Boolean(group.transfers_suggested_ui)}
      >
        <GroupDetailMeta
          groupId={group.id}
          initialName={group.name}
          initialCurrency={group.currency as "ARS" | "USD"}
          initialParticipants={
            (participants ?? []).map((p) => ({
              id: p.id,
              display_name: p.display_name,
              is_self: p.is_self,
              payment_alias: p.payment_alias as string | null,
            }))
          }
          initialNetBalanceCentsByParticipantId={netBalanceCentsByParticipantId}
          selfParticipantDisplayName={selfParticipantDisplayName}
        />
        <GroupExpensesSection
          groupId={group.id}
          currency={group.currency}
          participants={participantsForExpenses}
          expenses={expenses}
        />
      </GroupTransfersUiProvider>
      <section
        className="border-t border-border pt-8"
        aria-label="Eliminar grupo"
      >
        <DeleteGroupButton groupId={group.id} groupName={group.name} />
      </section>
    </div>
  );
}
