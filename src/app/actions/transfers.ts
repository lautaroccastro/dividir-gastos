"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateGroup(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
}

async function assertOwnGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: group, error } = await supabase
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !group) {
    return { ok: false, error: "No se encontró el grupo." };
  }
  return { ok: true };
}

export async function setTransferDoneAction(input: {
  groupId: string;
  transferKey: string;
  done: boolean;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const ownCheck = await assertOwnGroup(supabase, input.groupId, user.id);
  if (!ownCheck.ok) return { error: ownCheck.error };

  if (input.done) {
    const { error } = await supabase.from("group_transfer_done").upsert(
      {
        group_id: input.groupId,
        transfer_key: input.transferKey,
      },
      { onConflict: "group_id,transfer_key" },
    );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("group_transfer_done")
      .delete()
      .eq("group_id", input.groupId)
      .eq("transfer_key", input.transferKey);
    if (error) return { error: error.message };
  }

  revalidateGroup(input.groupId);
}

export async function clearTransferDoneAction(input: {
  groupId: string;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const ownCheck = await assertOwnGroup(supabase, input.groupId, user.id);
  if (!ownCheck.ok) return { error: ownCheck.error };

  const { error } = await supabase
    .from("group_transfer_done")
    .delete()
    .eq("group_id", input.groupId);
  if (error) return { error: error.message };
  revalidateGroup(input.groupId);
}
