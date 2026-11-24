export const LEGACY_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
export interface CalendarEdition {
  planning_mode?: string | null;
  operation_dates?: unknown;
  start_date?: string | null;
  end_date?: string | null;
}

export function isOperationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateOperationDates(value: unknown, edition: CalendarEdition): string[] {
  if (!Array.isArray(value) || value.length > 366 || !value.every(isOperationDate)) throw new Error('Choisissez au maximum 366 dates d’opération valides.');
  const dates = [...new Set(value)].sort();
  if (dates.some(date => isOperationDate(edition.start_date) && date < edition.start_date || isOperationDate(edition.end_date) && date > edition.end_date)) throw new Error('Les opérations doivent être comprises dans les dates de la mission.');
  return dates;
}

export function operationDateRange(start: string, end: string): string[] {
  if (!isOperationDate(start) || !isOperationDate(end) || start > end) throw new Error('La date de fin doit être égale ou postérieure à la date de début.');
  const dates: string[] = [];
  const date = new Date(`${start}T12:00:00Z`);
  while (date.toISOString().slice(0, 10) <= end) {
    if (dates.length >= 366) throw new Error('La période ne peut pas dépasser 366 jours.');
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

export function getOperationDays(edition: CalendarEdition | null | undefined): string[] {
  // Old clients/editions without metadata keep the historic planning until master-data sync.
  if (!edition || !edition.planning_mode || edition.planning_mode === 'legacy_weekdays') return [...LEGACY_DAYS];
  // Mission start/end include travel and screening; never infer operation dates from them.
  try { return validateOperationDates(edition.operation_dates || [], edition); } catch { return []; }
}

export function formatOperationDay(value: string | null | undefined, locale = 'fr'): string {
  if (!value) return 'À définir';
  if (!isOperationDate(value)) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

export function isUnscheduled(value: string | null | undefined): boolean {
  return !value || ['a definir', 'jour a definir', 'non precise'].includes(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
}

export class PlanningDateError extends Error {}

export function validatePlanningAssignment(value: unknown, edition: CalendarEdition | null | undefined, previous?: string | null): void {
  // Editing another field on an old/out-of-calendar dossier must remain possible.
  if (value === previous || value === null || value === undefined || typeof value === 'string' && isUnscheduled(value)) return;
  if (typeof value !== 'string' || !getOperationDays(edition).includes(value)) throw new PlanningDateError('La date choisie ne fait pas partie du calendrier des opérations de cette édition.');
}
