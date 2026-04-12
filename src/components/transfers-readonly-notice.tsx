/**
 * Aviso común cuando la vista de transferencias sugeridas está activa
 * (gastos y participantes en solo lectura).
 */
export function TransfersReadonlyNotice() {
  return (
    <p
      className="text-sm font-medium text-amber-600 dark:text-amber-400"
      role="status"
    >
      Gastos en solo lectura hasta que uses «Volver a editar».
    </p>
  );
}
