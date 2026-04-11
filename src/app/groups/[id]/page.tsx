import { DeleteGroupButton } from "@/components/delete-group-button";
import {
  GroupExpensesSection,
  type GroupExpenseRow,
} from "@/components/group-expenses-section";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    .select("id, name, currency, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !group) {
    notFound();
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, sort_order")
    .eq("group_id", id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Mis grupos
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          Moneda: <span className="text-foreground">{group.currency}</span>
        </p>
      </header>
      <GroupExpensesSection
        groupId={group.id}
        currency={group.currency}
        participants={participants ?? []}
        expenses={expenses}
      />
      <section
        className="border-t border-border pt-8"
        aria-label="Eliminar grupo"
      >
        <DeleteGroupButton groupId={group.id} groupName={group.name} />
      </section>
    </div>
  );
}
