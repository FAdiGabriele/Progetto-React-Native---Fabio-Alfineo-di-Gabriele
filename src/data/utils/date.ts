// Date and time with optional seconds and fraction, then "Z" or a "+hh:mm" or "-hh:mm" offset.
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/**
 * Parses an ISO 8601 date-time string such as "2026-09-23T10:15:00Z";
 * undefined when the value has another form or is not a valid date.
 */
export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  if (!ISO_DATE_TIME_PATTERN.test(text)) {
    return undefined;
  }
  const date = new Date(text);
  return isValidDate(date) ? date : undefined;
}
