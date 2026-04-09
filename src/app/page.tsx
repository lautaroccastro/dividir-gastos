import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold text-foreground">Dividir gastos</h1>
        <p className="text-muted-foreground">
          {/* Placeholder until the “Mis grupos” slice replaces this copy. */}
          Sesión lista. Próximo paso: listado de grupos.
        </p>
        {user ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-sm text-foreground">
              Sesión: <span className="font-medium">{user.email}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Salir
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="mt-2 inline-flex w-fit rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Iniciar sesión
          </Link>
        )}
      </header>

      {user ? (
        <section className="text-muted-foreground">
          <p className="text-sm">
            Acá irá <strong className="text-foreground">Mis grupos</strong> (primer
            slice del producto).
          </p>
        </section>
      ) : null}
    </div>
  );
}
