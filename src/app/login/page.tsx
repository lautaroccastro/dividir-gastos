import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
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
        <h1 className="text-2xl font-semibold text-foreground">Inicia sesión</h1>
        <p className="mt-2 text-muted-foreground">
          Usando tu cuenta de Google o tu dirección de correo
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
