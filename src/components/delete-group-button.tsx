"use client";

import { deleteGroupAction } from "@/app/actions/groups";
import { useState, useTransition } from "react";

type Props = {
  groupId: string;
  groupName: string;
};

export function DeleteGroupButton({ groupId, groupName }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `¿Borrar el grupo «${groupName}»? Se borran también participantes y gastos. No se puede deshacer.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGroupAction(groupId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="self-start rounded-md border border-destructive-border bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Borrando…" : "Borrar grupo"}
      </button>
      {error ? (
        <p className="text-sm text-destructive-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
