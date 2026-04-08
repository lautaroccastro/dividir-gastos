import { addNote, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let notes: { id: string; body: string; created_at: string }[] = [];
  if (user) {
    const { data } = await supabase
      .from("mvp_notes")
      .select("id, body, created_at")
      .order("created_at", { ascending: false });
    notes = data ?? [];
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Dividir gastos</h1>
        <p className="text-zinc-600">
          MVP: sesión Supabase + una tabla de prueba en la base.
        </p>
        {user ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-sm text-zinc-700">
              Sesión: <span className="font-medium">{user.email}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-zinc-500 underline hover:text-zinc-800"
              >
                Salir
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="mt-2 inline-flex w-fit rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Iniciar sesión
          </Link>
        )}
      </header>

      {user ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900">Nota de prueba</h2>
          <p className="text-sm text-zinc-600">
            Guardá un texto para verificar que la fila se persiste con tu usuario
            (RLS en Supabase).
          </p>
          {params.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {params.error}
            </p>
          ) : null}
          <form action={addNote} className="flex flex-col gap-2">
            <textarea
              name="body"
              rows={3}
              placeholder="Ej.: Primera prueba desde producción"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
            />
            <button
              type="submit"
              className="w-fit rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Guardar en la base
            </button>
          </form>

          <ul className="mt-4 flex flex-col gap-2">
            {notes.length === 0 ? (
              <li className="text-sm text-zinc-500">Todavía no hay notas.</li>
            ) : (
              notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                >
                  {n.body}
                  <span className="mt-1 block text-xs text-zinc-500">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
