"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addNote(formData: FormData) {
  const body = (formData.get("body") as string | null)?.trim();
  if (!body) {
    redirect("/?error=" + encodeURIComponent("Escribí algo para guardar."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/?error=" + encodeURIComponent("Tenés que iniciar sesión."));
  }

  const { error } = await supabase.from("mvp_notes").insert({
    body,
    user_id: user.id,
  });

  if (error) {
    redirect("/?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
