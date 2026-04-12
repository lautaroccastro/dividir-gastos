/** Max length for expense title (name). */
export const EXPENSE_TITLE_MAX = 50;

export type ExpenseAmountOk = { ok: true; amountStr: string };
export type ExpenseAmountErr = { ok: false; error: string };
export type ExpenseAmountResult = ExpenseAmountOk | ExpenseAmountErr;

/**
 * Parses amount in group currency: if the user does not type comma or dot, the value is whole units (integer).
 * If they use `,` or `.`, up to 2 decimal digits are allowed.
 * Returns a string suitable for Postgres `numeric` (e.g. "123.45").
 */
export function parseExpenseAmount(raw: string): ExpenseAmountResult {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) {
    return { ok: false, error: "Ingresá un monto." };
  }

  if (!/[.,]/.test(s)) {
    if (!/^\d+$/.test(s)) {
      return { ok: false, error: "El monto solo puede tener números, o coma/punto para decimales." };
    }
    if (s.length > 12) {
      return { ok: false, error: "El monto es demasiado grande." };
    }
    return { ok: true, amountStr: `${s}.00` };
  }

  const m = s.match(/^(\d+)[.,](\d{1,2})$/);
  if (!m) {
    return {
      ok: false,
      error: "Usá coma o punto solo para decimales (hasta 2 dígitos), sin separador de miles.",
    };
  }
  const whole = m[1];
  const frac = m[2];
  if (whole.length > 12) {
    return { ok: false, error: "El monto es demasiado grande." };
  }
  const fracTwo = frac.padEnd(2, "0").slice(0, 2);
  return { ok: true, amountStr: `${whole}.${fracTwo}` };
}

export type ExpenseDateOk = { ok: true; isoDate: string };
export type ExpenseDateErr = { ok: false; error: string };
export type ExpenseDateResult = ExpenseDateOk | ExpenseDateErr;

/**
 * Parses YYYY-MM-DD (same as `<input type="date">` value) into a normalized ISO date string.
 */
export function parseExpenseDateIso(raw: string): ExpenseDateResult {
  const s = raw.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return { ok: false, error: "Elegí una fecha válida." };
  }
  const yyyy = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const dd = parseInt(m[3], 10);
  const trial = new Date(yyyy, mm - 1, dd);
  if (
    trial.getFullYear() !== yyyy ||
    trial.getMonth() !== mm - 1 ||
    trial.getDate() !== dd
  ) {
    return { ok: false, error: "Esa fecha no es válida." };
  }
  return { ok: true, isoDate: s };
}

/** Formats an ISO date (YYYY-MM-DD) as DD-MM-YY for display. */
export function formatExpenseDateDdMmYy(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const yyyy = parseInt(m[1], 10);
  const mm = m[2];
  const dd = m[3];
  const yy = String(yyyy % 100).padStart(2, "0");
  return `${dd}-${mm}-${yy}`;
}

/** Formats an ISO date (YYYY-MM-DD) as DD-MM-YYYY for display. */
export function formatExpenseDateDdMmYyyy(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const yyyy = m[1];
  const mm = m[2];
  const dd = m[3];
  return `${dd}-${mm}-${yyyy}`;
}

/** Today's local date as YYYY-MM-DD for `<input type="date">`. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Strips time from Postgres / ISO strings so `type="date"` accepts the value. */
export function toDateInputValue(isoOrTimestamp: string): string {
  const m = isoOrTimestamp.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : isoOrTimestamp.slice(0, 10);
}

export function normalizeExpenseTitle(raw: string): { ok: true; title: string } | { ok: false; error: string } {
  const title = raw.trim();
  if (!title) {
    return { ok: false, error: "Ingresá un nombre para el gasto." };
  }
  if (title.length > EXPENSE_TITLE_MAX) {
    return { ok: false, error: `El nombre no puede superar ${EXPENSE_TITLE_MAX} caracteres.` };
  }
  return { ok: true, title };
}
