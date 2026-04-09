import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: groups } = user
    ? await supabase
        .from("groups")
        .select("id, name, currency, created_at")
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold text-foreground">Mis grupos</h1>
        {user ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-sm text-foreground">
              <span className="font-medium">{user.email}</span>
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
          <p className="text-muted-foreground">
            <Link href="/login" className="font-medium text-primary underline">
              Iniciá sesión
            </Link>{" "}
            para ver tus grupos.
          </p>
        )}
      </header>

      {user ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">Listado</h2>
            <Link
              href="/groups/new"
              className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Nuevo grupo
            </Link>
          </div>

          {!groups?.length ? (
            <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Todavía no tenés grupos. Creá uno para empezar a cargar gastos.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex flex-col rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-card-foreground">
                      {g.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {g.currency}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
