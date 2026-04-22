import { ProfileNicknameForm } from "@/components/profile-nickname-form";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-12">
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground"
        >
          No pudimos cargar tu perfil: {error.message}
        </div>
        <p className="text-sm text-muted-foreground">
          Revisá la conexión o que la tabla{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">profiles</code> exista en
          Supabase (script <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase-slice6-profiles.sql</code>
          ).
        </p>
        <Link
          href="/onboarding"
          className="text-sm font-medium text-primary hover:underline"
        >
          Reintentar
        </Link>
      </div>
    );
  }

  if (profile?.nickname && String(profile.nickname).trim()) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-4 py-12">
      <ProfileNicknameForm
        title="Elegí tu apodo"
        description="En tus grupos vas a aparecer como «Apodo (Tú)»."
        submitLabel="Continuar"
        redirectPath="/"
      />
    </div>
  );
}
