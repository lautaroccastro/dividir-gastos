import { CreateGroupForm } from "@/components/create-group-form";
import { formatSelfParticipantDisplayName } from "@/lib/text/self-participant-display";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
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
          No pudimos cargar tu perfil ({profileError.message}).
        </div>
        <Link href="/cuenta" className="text-sm font-medium text-primary hover:underline">
          Ir a Cuenta
        </Link>
      </div>
    );
  }

  const nickname = profile?.nickname?.trim();
  if (!nickname) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Mis grupos
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Nuevo grupo</h1>
        <p className="text-sm text-muted-foreground">
          Definí el nombre, la moneda y quiénes participan.
        </p>
      </header>
      <CreateGroupForm
        selfParticipantDisplayName={formatSelfParticipantDisplayName(nickname)}
      />
    </div>
  );
}
