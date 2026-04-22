"use client";

import { saveProfileNicknameAction } from "@/app/actions/profile";
import { PARTICIPANT_NAME_MAX } from "@/lib/validation/group-create";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  initialNickname?: string;
  title: string;
  description?: string;
  submitLabel: string;
  /** After successful save when no `redirectPath` (e.g. cuenta). */
  onSuccess?: () => void;
  /** e.g. "/" after onboarding */
  redirectPath?: string;
};

export function ProfileNicknameForm({
  initialNickname = "",
  title,
  description,
  submitLabel,
  onSuccess,
  redirectPath,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialNickname);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const savedHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedHideTimer.current) clearTimeout(savedHideTimer.current);
    };
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedOk(false);
    if (savedHideTimer.current) {
      clearTimeout(savedHideTimer.current);
      savedHideTimer.current = null;
    }
    startTransition(async () => {
      const result = await saveProfileNicknameAction(value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (redirectPath) {
        router.push(redirectPath);
        router.refresh();
        return;
      }
      setSavedOk(true);
      savedHideTimer.current = setTimeout(() => setSavedOk(false), 5000);
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </div>
      ) : null}
      {savedOk && !error ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100"
        >
          Apodo guardado correctamente.
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-nickname" className="text-sm font-medium text-foreground">
          Apodo
        </label>
        <input
          id="profile-nickname"
          type="text"
          name="nickname"
          maxLength={PARTICIPANT_NAME_MAX}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSavedOk(false);
            if (savedHideTimer.current) {
              clearTimeout(savedHideTimer.current);
              savedHideTimer.current = null;
            }
          }}
          required
          autoComplete="nickname"
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
          placeholder="Cómo te mostramos en tus grupos"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">Máximo 25 caracteres</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
