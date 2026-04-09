import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/**
 * Group detail (expenses will live here in a later slice).
 */
export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, currency, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !group) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Mis grupos
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          Moneda: <span className="text-foreground">{group.currency}</span>
        </p>
      </header>
      <section
        className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        aria-label="Próximamente: gastos del grupo"
      >
        Acá irá el detalle de gastos y saldos. Próxima entrega.
      </section>
    </div>
  );
}
