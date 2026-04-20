/**
 * Treat an ISO date string (YYYY-MM-DD) as a calendar day label.
 *
 * Important: do NOT parse via `new Date('YYYY-MM-DD')` because that can shift the
 * rendered day depending on client timezone/environment. This helper formats the
 * day in UTC so every user sees the same bucket date the backend returned.
 */
export function formatIsoDateLabel(isoDate: string, locale: string = 'en-US'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate;

  // Represent the calendar day as a UTC instant, then format explicitly in UTC.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return isoDate;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

