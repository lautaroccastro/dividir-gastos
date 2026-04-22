import { ProfileNicknameForm } from "@/components/profile-nickname-form";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CuentaPage() {
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
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Mis grupos
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-4 py-3 text-sm text-destructive-foreground"
        >
          No pudimos cargar tu perfil: {error.message}
        </div>
      </div>
    );
  }

  const nickname = profile?.nickname?.trim();
  if (!nickname) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-4 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Mis grupos
      </Link>
      <section aria-label="Cuenta">
        <p className="mb-6 text-sm text-muted-foreground">
          Sesión:{" "}
          <span className="font-medium text-foreground">{user.email ?? user.id}</span>
        </p>
        <ProfileNicknameForm
          initialNickname={nickname}
          title="Tu apodo"
          description="Se usa en todos los grupos como «Apodo (Tú)»."
          submitLabel="Guardar apodo"
        />
      </section>
    </div>
  );
}
