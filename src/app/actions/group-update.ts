"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildUpdateGroupPayload,
  type UpdateGroupPayloadInput,
} from "@/lib/validation/group-update";
import { revalidatePath } from "next/cache";

export type UpdateGroupInput = UpdateGroupPayloadInput & {
  groupId: string;
};

type RemovalCheck =
  | { ok: true }
  | { ok: false; error: string };

async function validateParticipantRemovals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  removedIds: string[],
): Promise<RemovalCheck> {
  if (removedIds.length === 0) return { ok: true };

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

  for (const rid of removedIds) {
    for (const row of expenses) {
      const e = row as {
        id: string;
        paid_by_participant_id: string;
        expense_split_participants: { participant_id: string }[] | null;
      };
      if (e.paid_by_participant_id === rid) {
        return {
          ok: false,
          error:
            "No podés borrar un participante que figura como quien pagó en uno o más gastos. Cambiá el gasto para que pague otra persona y volvé a intentar.",
        };
      }
      const splitIds = (e.expense_split_participants ?? []).map((s) => s.participant_id);
      if (splitIds.includes(rid) && splitIds.length === 1) {
        return {
          ok: false,
          error:
            "No podés borrar al único participante del reparto de un gasto. Agregá otra persona al reparto de ese gasto o borrá el gasto.",
        };
      }
    }
  }

  return { ok: true };
}

export async function updateGroupAction(
  input: UpdateGroupInput,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const built = buildUpdateGroupPayload({
    rawGroupName: input.rawGroupName,
    currency: input.currency,
    participants: input.participants,
  });
  if (!built.ok) {
    return { error: built.error };
  }

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", input.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gErr || !group) {
    return { error: "No se encontró el grupo." };
  }

  const lowerNew = built.groupName.trim().toLowerCase();
  if (group.name.trim().toLowerCase() !== lowerNew) {
    const { data: existingRows, error: listErr } = await supabase
      .from("groups")
      .select("id, name")
      .eq("user_id", user.id)
      .neq("id", input.groupId);

    if (listErr) {
      return { error: listErr.message };
    }
    const nameTaken = existingRows?.some(
      (row) => row.name.trim().toLowerCase() === lowerNew,
    );
    if (nameTaken) {
      return { error: "Ya tenés otro grupo con ese nombre." };
    }
  }

  const { data: currentParticipants, error: cpErr } = await supabase
    .from("participants")
    .select("id")
    .eq("group_id", input.groupId);

  if (cpErr || !currentParticipants) {
    return { error: cpErr?.message ?? "No se pudieron leer los participantes." };
  }

  const currentIds = new Set(currentParticipants.map((p) => p.id));
  const payloadExistingIds = new Set(
    built.rows.map((r) => r.serverId).filter((id): id is string => !!id),
  );

  for (const id of payloadExistingIds) {
    if (!currentIds.has(id)) {
      return { error: "Participante inválido o desactualizado. Recargá la página." };
    }
  }

  const removedIds = [...currentIds].filter((id) => !payloadExistingIds.has(id));

  const removalCheck = await validateParticipantRemovals(supabase, input.groupId, removedIds);
  if (!removalCheck.ok) {
    return { error: removalCheck.error };
  }

  for (const pid of removedIds) {
    const { error: splitDelErr } = await supabase
      .from("expense_split_participants")
      .delete()
      .eq("participant_id", pid);
    if (splitDelErr) {
      return { error: splitDelErr.message };
    }
  }

  for (const pid of removedIds) {
    const { error: pDelErr } = await supabase.from("participants").delete().eq("id", pid);
    if (pDelErr) {
      return { error: pDelErr.message };
    }
  }

  const { error: updGroupErr } = await supabase
    .from("groups")
    .update({
      name: built.groupName,
      currency: built.currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.groupId)
    .eq("user_id", user.id);

  if (updGroupErr) {
    return { error: updGroupErr.message };
  }

  for (const row of built.rows) {
    if (row.serverId) {
      const { error: uErr } = await supabase
        .from("participants")
        .update({
          display_name: row.displayName,
          is_self: row.isSelf,
          sort_order: row.sortOrder,
        })
        .eq("id", row.serverId)
        .eq("group_id", input.groupId);
      if (uErr) {
        return { error: uErr.message };
      }
    } else {
      const { error: iErr } = await supabase.from("participants").insert({
        group_id: input.groupId,
        display_name: row.displayName,
        is_self: row.isSelf,
        sort_order: row.sortOrder,
      });
      if (iErr) {
        return { error: iErr.message };
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/groups/${input.groupId}`);
}
