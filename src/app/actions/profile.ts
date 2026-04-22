"use server";

import { createClient } from "@/lib/supabase/server";
import {
  formatStoredProfileNickname,
  validateRawProfileNickname,
} from "@/lib/validation/profile";
import { revalidatePath } from "next/cache";

function revalidateAfterProfileChange() {
  revalidatePath("/", "layout");
  revalidatePath("/cuenta");
  revalidatePath("/onboarding");
}

export async function saveProfileNicknameAction(
  rawNickname: string,
): Promise<{ error: string } | void> {
  const validationError = validateRawProfileNickname(rawNickname);
  if (validationError) return { error: validationError };

  const formatted = formatStoredProfileNickname(rawNickname);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      nickname: formatted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };
  revalidateAfterProfileChange();
}
