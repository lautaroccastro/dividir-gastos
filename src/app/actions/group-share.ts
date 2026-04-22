"use server";

import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

function newShareToken(): string {
  return randomBytes(24).toString("hex");
}

export async function setGroupShareEnabledAction(input: {
  groupId: string;
  enabled: boolean;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data: row, error: selErr } = await supabase
    .from("groups")
    .select("id, share_token")
    .eq("id", input.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr || !row) return { error: "No se encontró el grupo." };

  if (!input.enabled) {
    const { error: updErr } = await supabase
      .from("groups")
      .update({
        share_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.groupId)
      .eq("user_id", user.id);

    if (updErr) return { error: updErr.message };
    revalidatePath(`/groups/${input.groupId}`);
    return;
  }

  let token = row.share_token ?? newShareToken();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error: updErr } = await supabase
      .from("groups")
      .update({
        share_enabled: true,
        share_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.groupId)
      .eq("user_id", user.id);

    if (!updErr) {
      revalidatePath(`/groups/${input.groupId}`);
      return;
    }
    const dup =
      updErr.code === "23505" ||
      String(updErr.message).toLowerCase().includes("duplicate");
    if (dup && attempt < 5) {
      token = newShareToken();
      continue;
    }
    return { error: updErr.message };
  }

  return { error: "No se pudo generar un enlace único. Probá de nuevo." };
}
