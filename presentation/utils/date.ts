const DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  let formatter = cache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(locale, formatter);
  }
  return formatter;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function format(formatter: Intl.DateTimeFormat, date: Date): string {
  const parts = formatter.formatToParts(date);
  // Engines disagree on the hour width of 24-hour locales ("9:05" or "09:05"): always two digits there.
  const twoDigitHour = !parts.some((part) => part.type === 'dayPeriod');
  return parts
    .map((part) => (twoDigitHour && part.type === 'hour' ? part.value.padStart(2, '0') : part.value))
    .join('')
    // Some ICU versions put a narrow no-break space before "PM": normalized to a plain space.
    .replace(/[  ]/g, ' ');
}

/**
 * Formats a date as an absolute date and time in the device time zone, in the given locale:
 * "24 set 2026, 14:30" for "it-IT", "Sep 24, 2026, 2:30 PM" for "en-US".
 * Undefined when the date is missing or invalid.
 */
export function formatDateTime(date: Date | undefined, locale: string): string | undefined {
  if (!date || !isValidDate(date)) {
    return undefined;
  }
  return format(getFormatter(dateTimeFormatters, locale, DATE_TIME_FORMAT_OPTIONS), date);
}

/**
 * Formats the time of day of a date in the device time zone, in the given locale:
 * "14:30" for "it-IT", "2:30 PM" for "en-US". Undefined when the date is missing or invalid.
 */
export function formatTime(date: Date | undefined, locale: string): string | undefined {
  if (!date || !isValidDate(date)) {
    return undefined;
  }
  return format(getFormatter(timeFormatters, locale, TIME_FORMAT_OPTIONS), date);
}

/** Whether the date falls on the current day of the device time zone; false for an invalid date. */
export function isToday(date: Date): boolean {
  if (!isValidDate(date)) {
    return false;
  }
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
