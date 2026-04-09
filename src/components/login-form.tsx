"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading}
        className="flex h-11 w-full items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        Continuar con Google
      </button>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-background px-2">o email</span>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-border" />
      </div>

      <form onSubmit={handleSignIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
          />
        </label>
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
  );
}
