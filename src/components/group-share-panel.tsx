"use client";

import { setGroupShareEnabledAction } from "@/app/actions/group-share";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  groupId: string;
  shareEnabled: boolean;
  shareToken: string | null;
};

export function GroupSharePanel({ groupId, shareEnabled, shareToken }: Props) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl =
    shareEnabled && shareToken && origin
      ? `${origin}/share/${shareToken}`
      : "";

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggle(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setGroupShareEnabledAction({
        groupId,
        enabled: next,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      className="flex flex-col gap-4 border-t border-border pt-8"
      aria-label="Compartir grupo"
    >
      <h2 className="text-lg font-semibold text-foreground">Compartir</h2>
      <p className="text-sm text-muted-foreground">
        Si activás el enlace público, <strong className="text-foreground">cualquiera con la URL</strong>{" "}
        puede ver el grupo, los gastos y los alias para cobrar. No podrán modificar nada.
      </p>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive-border bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">Enlace público</span>
        <button
          type="button"
          role="switch"
          aria-checked={shareEnabled}
          disabled={pending}
          onClick={() => toggle(!shareEnabled)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            shareEnabled ? "bg-primary" : "bg-muted"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-1 left-1 block h-6 w-6 rounded-full bg-background shadow transition-transform ${
              shareEnabled ? "translate-x-6" : "translate-x-0"
            }`}
            aria-hidden
          />
        </button>
        <span className="text-sm text-muted-foreground">
          {shareEnabled ? "Activado" : "Desactivado"}
        </span>
      </div>
      {shareEnabled && shareToken ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="share-url-field">
            URL pública
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id="share-url-field"
              readOnly
              value={shareUrl}
              suppressHydrationWarning
              className="min-w-0 flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={!shareUrl}
              className="shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
