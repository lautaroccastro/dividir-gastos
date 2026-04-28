import {
  GroupExpensesSection,
  type GroupExpenseRow,
} from "@/components/group-expenses-section";
import { GroupDetailMeta } from "@/components/group-detail-meta";
import { GroupTransfersUiProvider } from "@/components/group-transfers-ui-context";
import { computeParticipantNetBalancesCents } from "@/lib/expense/balance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ token: string }> };

type ExpenseSplitRow = { participant_id: string };

type ExpenseQueryRow = {
  id: string;
  title: string;
  amount: string | number;
  expense_date: string;
  paid_by_participant_id: string;
  expense_split_participants: ExpenseSplitRow[] | null;
};

const PRIVATE_MSG =
  "Este grupo es privado, pidele al dueño que lo comparta." as const;

export const metadata = {
  title: "Grupo compartido",
  robots: { index: false, follow: false } as const,
};

function SharePageNavLink({ isLoggedIn }: { isLoggedIn: boolean }) {
  return isLoggedIn ? (
    <Link
      href="/"
      className="mt-8 text-sm font-medium text-primary underline hover:opacity-90"
    >
      Ir al inicio
    </Link>
  ) : (
    <Link
      href="/login"
      className="mt-8 text-sm font-medium text-primary underline hover:opacity-90"
    >
      Iniciar sesión
    </Link>
  );
}

function PrivateShareMessage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-16 text-center">
      <p className="text-base text-muted-foreground">{PRIVATE_MSG}</p>
      <SharePageNavLink isLoggedIn={isLoggedIn} />
    </div>
  );
}

/** Grupo inexistente, token incorrecto o grupo borrado (no distinguimos sin datos extra). */
function InvalidShareLinkMessage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-16 text-center">
      <p className="text-base font-medium text-foreground">No encontramos este grupo</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Puede que se haya eliminado o que el enlace no sea válido.
      </p>
      <SharePageNavLink isLoggedIn={isLoggedIn} />
    </div>
  );
}

export default async function SharedGroupPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  if (!token?.trim()) {
    return <InvalidShareLinkMessage isLoggedIn={isLoggedIn} />;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-sm text-muted-foreground">
        <p>
          Falta configurar{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          en el servidor para abrir enlaces compartidos.
        </p>
      </div>
    );
  }

  const { data: group, error: groupErr } = await admin
    .from("groups")
    .select(
      "id, name, currency, user_id, transfers_suggested_ui, share_enabled, share_token",
    )
    .eq("share_token", token)
    .maybeSingle();

  if (groupErr || !group || group.share_token !== token) {
    return <InvalidShareLinkMessage isLoggedIn={isLoggedIn} />;
  }

  if (user && user.id === group.user_id) {
    redirect(`/groups/${group.id}`);
  }

  if (!group.share_enabled) {
    return <PrivateShareMessage isLoggedIn={isLoggedIn} />;
  }

  const groupId = group.id as string;

  const [{ data: participants }, { data: ownerProfile }, { data: expensesRaw }] =
    await Promise.all([
      admin
        .from("participants")
        .select("id, display_name, sort_order, is_self, payment_alias")
        .eq("group_id", groupId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      admin
        .from("profiles")
        .select("nickname")
        .eq("id", group.user_id as string)
        .maybeSingle(),
      admin
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
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  const ownerNickname = ownerProfile?.nickname?.trim() || "—";

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

  const participantsForExpenses =
    participants?.map((p) => ({
      id: p.id,
      display_name: p.is_self ? ownerNickname : p.display_name,
      sort_order: p.sort_order,
      payment_alias: p.payment_alias as string | null,
    })) ?? [];

  const participantIdsOrdered = (participants ?? []).map((p) => p.id);
  const netBalanceCentsByParticipantId = Object.fromEntries(
    computeParticipantNetBalancesCents(expenses, participantIdsOrdered),
  );
  const totalExpensesCents = expenses.reduce((acc, row) => {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) return acc;
    return acc + Math.round(amount * 100);
  }, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      {user ? (
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Ir al inicio
        </Link>
      ) : null}

      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Vista compartida · solo lectura
      </p>

      {!user ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
          <span className="text-muted-foreground">
            ¿Querés crear tus propios grupos y cargar gastos?{" "}
          </span>
          <Link href="/login" className="font-medium text-primary underline">
            Iniciá sesión o creá una cuenta
          </Link>
          .
        </div>
      ) : null}

      <GroupTransfersUiProvider initialTransfersSuggestedUi={false}>
        <GroupDetailMeta
          groupId={groupId}
          initialName={group.name as string}
          initialCurrency={group.currency as "ARS" | "USD"}
          totalExpensesCents={totalExpensesCents}
          initialParticipants={
            (participants ?? []).map((p) => ({
              id: p.id,
              display_name: p.display_name,
              is_self: p.is_self,
              payment_alias: p.payment_alias as string | null,
            }))
          }
          initialNetBalanceCentsByParticipantId={netBalanceCentsByParticipantId}
          selfParticipantDisplayName={ownerNickname}
          readOnly
        />
        <GroupExpensesSection
          groupId={groupId}
          currency={group.currency as string}
          participants={participantsForExpenses}
          expenses={expenses}
          readOnly
        />
      </GroupTransfersUiProvider>
    </div>
  );
}
