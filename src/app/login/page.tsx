import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Inicio
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Acceder
        </h1>
        <p className="mt-2 text-muted-foreground">
          MVP: Google o email con confirmación por correo.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
