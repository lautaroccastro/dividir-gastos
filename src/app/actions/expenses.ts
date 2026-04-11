"use server";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeExpenseTitle,
  parseExpenseAmount,
  parseExpenseDateIso,
} from "@/lib/validation/expense";
import { revalidatePath } from "next/cache";

export type UpsertExpenseInput = {
  groupId: string;
  /** Omit on create; required on update. */
  expenseId?: string;
  rawTitle: string;
  rawAmount: string;
  /** YYYY-MM-DD from `<input type="date">`. */
  expenseDateIso: string;
  paidByParticipantId: string;
  splitParticipantIds: string[];
};

async function loadGroupParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  userId: string,
): Promise<
  | { ok: true; rows: { id: string; sort_order: number }[] }
  | { ok: false; error: string }
> {
  const { data: group, error: gErr } = await supabase
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (gErr || !group) {
    return { ok: false, error: "No se encontró el grupo." };
  }

  const { data: rows, error: pErr } = await supabase
    .from("participants")
    .select("id, sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (pErr || !rows?.length) {
    return { ok: false, error: "El grupo no tiene participantes." };
  }
  return { ok: true, rows };
}

function orderSplitIds(
  selected: Set<string>,
  participants: { id: string; sort_order: number }[],
): string[] {
  return participants.filter((p) => selected.has(p.id)).map((p) => p.id);
}

function validateParticipantsBelong(
  paidBy: string,
  splitIds: string[],
  participantIds: Set<string>,
): string | null {
  if (!participantIds.has(paidBy)) {
    return "Quién pagó tiene que ser un participante del grupo.";
  }
  if (splitIds.length === 0) {
    return "Tenés que elegir al menos un participante para el reparto.";
  }
  for (const id of splitIds) {
    if (!participantIds.has(id)) {
      return "El reparto solo puede incluir participantes del grupo.";
    }
  }
  return null;
}

export async function createExpenseAction(
  input: UpsertExpenseInput,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const titleRes = normalizeExpenseTitle(input.rawTitle);
  if (!titleRes.ok) return { error: titleRes.error };

  const amountRes = parseExpenseAmount(input.rawAmount);
  if (!amountRes.ok) return { error: amountRes.error };

  const dateRes = parseExpenseDateIso(input.expenseDateIso);
  if (!dateRes.ok) return { error: dateRes.error };

  const loaded = await loadGroupParticipants(supabase, input.groupId, user.id);
  if (!loaded.ok) return { error: loaded.error };

  const idSet = new Set(loaded.rows.map((r) => r.id));
  const splitOrdered = orderSplitIds(new Set(input.splitParticipantIds), loaded.rows);
  const partErr = validateParticipantsBelong(
    input.paidByParticipantId,
    splitOrdered,
    idSet,
  );
  if (partErr) return { error: partErr };

  const { data: inserted, error: insErr } = await supabase
    .from("expenses")
    .insert({
      group_id: input.groupId,
      title: titleRes.title,
      amount: amountRes.amountStr,
      paid_by_participant_id: input.paidByParticipantId,
      expense_date: dateRes.isoDate,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return { error: insErr?.message ?? "No se pudo crear el gasto." };
  }

  const splitRows = splitOrdered.map((participant_id) => ({
    expense_id: inserted.id,
    participant_id,
  }));

  const { error: splitErr } = await supabase
    .from("expense_split_participants")
    .insert(splitRows);

  if (splitErr) {
    await supabase.from("expenses").delete().eq("id", inserted.id);
    return { error: splitErr.message };
  }

  revalidatePath(`/groups/${input.groupId}`);
}

export async function updateExpenseAction(
  input: UpsertExpenseInput,
): Promise<{ error: string } | void> {
  if (!input.expenseId) {
    return { error: "Falta el gasto a editar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const titleRes = normalizeExpenseTitle(input.rawTitle);
  if (!titleRes.ok) return { error: titleRes.error };

  const amountRes = parseExpenseAmount(input.rawAmount);
  if (!amountRes.ok) return { error: amountRes.error };

  const dateRes = parseExpenseDateIso(input.expenseDateIso);
  if (!dateRes.ok) return { error: dateRes.error };

  const { data: existing, error: exErr } = await supabase
    .from("expenses")
    .select("id, group_id")
    .eq("id", input.expenseId)
    .maybeSingle();

  if (exErr || !existing || existing.group_id !== input.groupId) {
    return { error: "No se encontró el gasto." };
  }

  const loaded = await loadGroupParticipants(supabase, input.groupId, user.id);
  if (!loaded.ok) return { error: loaded.error };

  const idSet = new Set(loaded.rows.map((r) => r.id));
  const splitOrdered = orderSplitIds(new Set(input.splitParticipantIds), loaded.rows);
  const partErr = validateParticipantsBelong(
    input.paidByParticipantId,
    splitOrdered,
    idSet,
  );
  if (partErr) return { error: partErr };

  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      title: titleRes.title,
      amount: amountRes.amountStr,
      paid_by_participant_id: input.paidByParticipantId,
      expense_date: dateRes.isoDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.expenseId);

  if (updErr) {
    return { error: updErr.message };
  }

  const { error: delErr } = await supabase
    .from("expense_split_participants")
    .delete()
    .eq("expense_id", input.expenseId);

  if (delErr) {
    return { error: delErr.message };
  }

  const splitRows = splitOrdered.map((participant_id) => ({
    expense_id: input.expenseId,
    participant_id,
  }));

  const { error: splitErr } = await supabase
    .from("expense_split_participants")
    .insert(splitRows);

  if (splitErr) {
    return { error: splitErr.message };
  }

  revalidatePath(`/groups/${input.groupId}`);
}

export async function deleteExpenseAction(input: {
  groupId: string;
  expenseId: string;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const { data: existing, error: exErr } = await supabase
    .from("expenses")
    .select("id, group_id")
    .eq("id", input.expenseId)
    .maybeSingle();

  if (exErr || !existing || existing.group_id !== input.groupId) {
    return { error: "No se encontró el gasto." };
  }

  const { error: delErr } = await supabase.from("expenses").delete().eq("id", input.expenseId);

  if (delErr) {
    return { error: delErr.message };
  }

  revalidatePath(`/groups/${input.groupId}`);
}
