import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        No se pudo iniciar sesión
      </h1>
      <p className="text-muted-foreground">
        El enlace expiró o es inválido. Probá de nuevo desde la página de acceso.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Volver al login
      </Link>
    </div>
  );
}
