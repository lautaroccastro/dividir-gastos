"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Mensaje si el texto no parece un email; null si el formato es aceptable. */
function emailFormatMessage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Ingresá tu correo.";
  // Formato simple: usuario@dominio.tld (evita falsos positivos obvios)
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  if (!ok) {
    return "Ingresá un correo con formato válido (ej. nombre@ejemplo.com).";
  }
  return null;
}

function FullscreenLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-6 shadow-lg">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground">Cargando…</p>
      </div>
    </div>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!loading) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [loading]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errMsg = emailFormatMessage(email);
    if (errMsg) {
      setEmailError(errMsg);
      setMessage(null);
      return;
    }
    setEmailError(null);
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Revisá tu correo para confirmar la cuenta.");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errMsg = emailFormatMessage(email);
    if (errMsg) {
      setEmailError(errMsg);
      setMessage(null);
      return;
    }
    setEmailError(null);
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.href = "/";
  }

  async function handleGoogle() {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    }
  }

  const overlay =
    loading && typeof document !== "undefined"
      ? createPortal(<FullscreenLoadingOverlay />, document.body)
      : null;

  return (
    <>
      {overlay}
    <div className="flex w-full max-w-sm flex-col gap-6">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <GoogleMark className="h-4 w-4 shrink-0" />
        Continuar con Google
      </button>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-background px-2">o email</span>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-border" />
      </div>

      <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Email</span>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "login-email-error" : undefined}
            className={`rounded-lg border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground ${
              emailError ? "border-destructive-border ring-1 ring-destructive-border" : "border-input"
            }`}
          />
        </label>
        {emailError ? (
          <p id="login-email-error" className="text-sm text-destructive-foreground" role="alert">
            {emailError}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Contraseña</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-11 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Iniciar sesión
        </button>
      </form>

      <form onSubmit={handleSignUp} className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={loading}
          className="h-10 text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
        >
          Crear cuenta (envía email de confirmación)
        </button>
      </form>

      {message ? (
        <p className="text-center text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
    </>
  );
}
