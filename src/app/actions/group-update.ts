"use server";

import { createClient } from "@/lib/supabase/server";
import { formatGroupName, formatParticipantName } from "@/lib/text/format-names";
import {
  PARTICIPANTS_MAX,
  SELF_PARTICIPANT_LABEL,
  normalizePaymentAlias,
  validateRawGroupName,
  validateRawParticipantName,
  validateRawPaymentAlias,
} from "@/lib/validation/group-create";
import { revalidatePath } from "next/cache";

function revalidateGroup(groupId: string) {
  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);
}

/** Clears the "transferencias sugeridas" UI flag when expenses or participant set changes. */
export async function clearGroupTransfersSuggestedUi(groupId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("groups")
    .update({
      transfers_suggested_ui: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("user_id", user.id);

  await supabase.from("group_transfer_done").delete().eq("group_id", groupId);
}

export async function setGroupTransfersSuggestedUiAction(input: {
  groupId: string;
  value: boolean;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { error: updErr } = await supabase
    .from("groups")
    .update({
      transfers_suggested_ui: input.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.groupId)
    .eq("user_id", user.id);

  if (updErr) return { error: updErr.message };
  revalidateGroup(input.groupId);
}

type RemovalCheck =
  | { ok: true }
  | { ok: false; error: string };

async function validateParticipantRemoval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  participantId: string,
): Promise<RemovalCheck> {
  const { data: expenses, error: expErr } = await supabase
    .from("expenses")
    .select(
      `
      id,
      paid_by_participant_id,
      expense_split_participants ( participant_id )
    `,
    )
    .eq("group_id", groupId);

  if (expErr || !expenses) {
    return { ok: false, error: expErr?.message ?? "No se pudieron leer los gastos." };
  }

  for (const row of expenses) {
    const e = row as {
      id: string;
      paid_by_participant_id: string;
      expense_split_participants: { participant_id: string }[] | null;
    };
    if (e.paid_by_participant_id === participantId) {
      return {
        ok: false,
        error:
          "No podés borrar un participante que figura como quien pagó en uno o más gastos. Cambiá el gasto para que pague otra persona y volvé a intentar.",
      };
    }
    const splitIds = (e.expense_split_participants ?? []).map((s) => s.participant_id);
    if (splitIds.includes(participantId) && splitIds.length === 1) {
      return {
        ok: false,
        error:
          "No podés borrar al único participante del reparto de un gasto. Agregá otra persona al reparto de ese gasto o borrá el gasto.",
      };
    }
  }

  return { ok: true };
}

export async function updateGroupNameAction(input: {
  groupId: string;
  rawGroupName: string;
}): Promise<{ error: string } | void> {
  const nameErr = validateRawGroupName(input.rawGroupName);
  if (nameErr) return { error: nameErr };

  const formattedName = formatGroupName(input.rawGroupName);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", input.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gErr || !group) return { error: "No se encontró el grupo." };

  const lowerNew = formattedName.trim().toLowerCase();
  if (group.name.trim().toLowerCase() !== lowerNew) {
    const { data: existingRows, error: listErr } = await supabase
      .from("groups")
      .select("id, name")
      .eq("user_id", user.id)
      .neq("id", input.groupId);

    if (listErr) return { error: listErr.message };
    const nameTaken = existingRows?.some(
      (row) => row.name.trim().toLowerCase() === lowerNew,
    );
    if (nameTaken) return { error: "Ya tenés otro grupo con ese nombre." };
  }

  const { error: updErr } = await supabase
    .from("groups")
    .update({ name: formattedName, updated_at: new Date().toISOString() })
    .eq("id", input.groupId)
    .eq("user_id", user.id);

  if (updErr) return { error: updErr.message };
  revalidateGroup(input.groupId);
}

export async function addParticipantAction(input: {
  groupId: string;
  rawDisplayName: string;
}): Promise<{ error: string } | void> {
  const nameErr = validateRawParticipantName(input.rawDisplayName);
  if (nameErr) return { error: nameErr };

  const formatted = formatParticipantName(input.rawDisplayName);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .select("id")
    .eq("id", input.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gErr || !group) return { error: "No se encontró el grupo." };

  const { data: existing, error: listErr } = await supabase
    .from("participants")
    .select("id, display_name, sort_order")
    .eq("group_id", input.groupId);

  if (listErr || !existing) return { error: listErr?.message ?? "No se pudieron leer los participantes." };

  if (existing.length >= PARTICIPANTS_MAX) {
    return { error: `Como máximo ${PARTICIPANTS_MAX} participantes.` };
  }

  if (formatted === SELF_PARTICIPANT_LABEL) {
    return {
      error:
        "Ese nombre está reservado para tu propia fila en el grupo (marcada como «Tú» en el sistema).",
    };
  }

  const lower = formatted.trim().toLowerCase();
  const dup = existing.some(
    (p) => p.display_name.trim().toLowerCase() === lower,
  );
  if (dup) return { error: "Ya hay un participante con ese nombre (ignorando mayúsculas)." };

  const maxSort = Math.max(0, ...existing.map((p) => p.sort_order));

  const { error: insErr } = await supabase.from("participants").insert({
    group_id: input.groupId,
    display_name: formatted,
    is_self: false,
    sort_order: maxSort + 1,
  });

  if (insErr) return { error: insErr.message };
  await clearGroupTransfersSuggestedUi(input.groupId);
  revalidateGroup(input.groupId);
}

export async function updateParticipantNameAction(input: {
  groupId: string;
  participantId: string;
  rawDisplayName: string;
  /** When set, `payment_alias` is updated together with the name (non–self participants). */
  rawPaymentAlias?: string;
}): Promise<{ error: string } | void> {
  const nameErr = validateRawParticipantName(input.rawDisplayName);
  if (nameErr) return { error: nameErr };

  if (input.rawPaymentAlias !== undefined) {
    const aliasErr = validateRawPaymentAlias(input.rawPaymentAlias);
    if (aliasErr) return { error: aliasErr };
  }

  const formatted = formatParticipantName(input.rawDisplayName);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: row, error: pErr } = await supabase
    .from("participants")
    .select("id, is_self, display_name, group_id")
    .eq("id", input.participantId)
    .eq("group_id", input.groupId)
    .maybeSingle();

  if (pErr || !row) return { error: "No se encontró el participante." };

  if (row.is_self) {
    return {
      error:
        "No podés renombrar tu propia fila del grupo. Cambiá tu apodo en Cuenta si querés otro nombre visible.",
    };
  }

  if (formatted === SELF_PARTICIPANT_LABEL) {
    return {
      error:
        "Ese nombre está reservado para la fila del dueño del grupo (sistema «Tú»).",
    };
  }

  const { data: others, error: oErr } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("group_id", input.groupId)
    .neq("id", input.participantId);

  if (oErr || !others) return { error: oErr?.message ?? "No se pudieron leer los participantes." };

  const lower = formatted.trim().toLowerCase();
  const dup = others.some((p) => p.display_name.trim().toLowerCase() === lower);
  if (dup) return { error: "Ya hay un participante con ese nombre (ignorando mayúsculas)." };

  const updatePayload: { display_name: string; payment_alias?: string | null } = {
    display_name: formatted,
  };
  if (input.rawPaymentAlias !== undefined) {
    updatePayload.payment_alias = normalizePaymentAlias(input.rawPaymentAlias);
  }

  const { error: uErr } = await supabase
    .from("participants")
    .update(updatePayload)
    .eq("id", input.participantId)
    .eq("group_id", input.groupId);

  if (uErr) return { error: uErr.message };
  revalidateGroup(input.groupId);
}

export async function updateParticipantPaymentAliasAction(input: {
  groupId: string;
  participantId: string;
  rawPaymentAlias: string;
}): Promise<{ error: string } | void> {
  const aliasErr = validateRawPaymentAlias(input.rawPaymentAlias);
  if (aliasErr) return { error: aliasErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: row, error: pErr } = await supabase
    .from("participants")
    .select("id, group_id")
    .eq("id", input.participantId)
    .eq("group_id", input.groupId)
    .maybeSingle();

  if (pErr || !row) return { error: "No se encontró el participante." };

  const { error: uErr } = await supabase
    .from("participants")
    .update({ payment_alias: normalizePaymentAlias(input.rawPaymentAlias) })
    .eq("id", input.participantId)
    .eq("group_id", input.groupId);

  if (uErr) return { error: uErr.message };
  revalidateGroup(input.groupId);
}

export async function deleteParticipantAction(input: {
  groupId: string;
  participantId: string;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: row, error: pErr } = await supabase
    .from("participants")
    .select("id, group_id")
    .eq("id", input.participantId)
    .eq("group_id", input.groupId)
    .maybeSingle();

  if (pErr || !row) return { error: "No se encontró el participante." };

  const { count, error: cErr } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("group_id", input.groupId);

  if (cErr) return { error: cErr.message };
  if ((count ?? 0) <= 1) {
    return { error: "Tiene que quedar al menos un participante en el grupo." };
  }

  const check = await validateParticipantRemoval(supabase, input.groupId, input.participantId);
  if (!check.ok) return { error: check.error };

  const { error: splitDelErr } = await supabase
    .from("expense_split_participants")
    .delete()
    .eq("participant_id", input.participantId);

  if (splitDelErr) return { error: splitDelErr.message };

  const { error: delErr } = await supabase
    .from("participants")
    .delete()
    .eq("id", input.participantId)
    .eq("group_id", input.groupId);

  if (delErr) return { error: delErr.message };
  await clearGroupTransfersSuggestedUi(input.groupId);
  revalidateGroup(input.groupId);
}
