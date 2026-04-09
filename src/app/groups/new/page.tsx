import { CreateGroupForm } from "@/components/create-group-form";
import Link from "next/link";

export default function NewGroupPage() {
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
      <CreateGroupForm />
    </div>
  );
}
