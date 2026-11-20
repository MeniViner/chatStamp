/** Format the same instant in the app language without changing its provenance. */
export function formatAppDate(value: string | number | null | undefined, language: string, timeZone?: string): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {})
  }).format(date);
}
