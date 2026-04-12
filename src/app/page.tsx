import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-12">
      <section
        className="flex flex-1 flex-col gap-4"
        aria-label="Tus grupos"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Mis grupos</h1>
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
                  className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="break-words font-medium text-card-foreground">
                    {g.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-auto border-t border-border pt-4">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="min-w-0 truncate text-sm text-foreground">
            <span className="font-medium">{user.email}</span>
          </span>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
