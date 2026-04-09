"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildCreatePayload,
  type CurrencyCode,
} from "@/lib/validation/group-create";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateGroupInput = {
  rawGroupName: string;
  /** Fixed catalog: ARS | USD only (chosen in the form `<select>`, not free text). */
  currency: CurrencyCode;
  participants: { displayName: string; isSelf: boolean }[];
};

/**
 * Creates a group and its participants. Redirects to /groups/[id] on success.
 * Rolls back the group row if inserting participants fails.
 */
export async function createGroupAction(
  input: CreateGroupInput,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión." };
  }

  const built = buildCreatePayload({
    rawGroupName: input.rawGroupName,
    currency: input.currency,
    participants: input.participants,
  });
  if (!built.ok) {
    return { error: built.error };
  }

  const { data: existingRows, error: listErr } = await supabase
    .from("groups")
    .select("name")
    .eq("user_id", user.id);

  if (listErr) {
    return { error: listErr.message };
  }

  const lowerNew = built.groupName.trim().toLowerCase();
  const nameTaken = existingRows?.some(
    (row) => row.name.trim().toLowerCase() === lowerNew,
  );
  if (nameTaken) {
    return { error: "Ya tenés un grupo con ese nombre." };
  }

  const { data: inserted, error: insertGroupErr } = await supabase
    .from("groups")
    .insert({
      user_id: user.id,
      name: built.groupName,
      currency: built.currency,
    })
    .select("id")
    .single();

  if (insertGroupErr || !inserted) {
    return {
      error: insertGroupErr?.message ?? "No se pudo crear el grupo.",
    };
  }

  const groupId = inserted.id;

  for (const row of built.rows) {
    const { error: pErr } = await supabase.from("participants").insert({
      group_id: groupId,
      display_name: row.displayName,
      is_self: row.isSelf,
      sort_order: row.sortOrder,
    });
    if (pErr) {
      await supabase.from("groups").delete().eq("id", groupId);
      return { error: pErr.message };
    }
  }

  revalidatePath("/");
  redirect(`/groups/${groupId}`);
}
